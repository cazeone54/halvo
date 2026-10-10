import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BROADCAST_LIMITS,
  broadcastQuota,
  buildBroadcastEmail,
  selectBroadcastRecipients,
  signUnsubscribeToken,
} from "@/lib/broadcast";
import { sendBroadcastEmails } from "@/lib/email.server";
import { BASE_URL } from "@/lib/site";

// Before migration 0017 is applied the broadcast tables don't exist. The
// composer reports that instead of erroring, and sending is refused cleanly.
const isMissingTable = (error: { code?: string; message: string } | null) =>
  !!error && (error.code === "42P01" || /schema cache|could not find the table/i.test(error.message));

async function loadAudience(
  // The user-scoped client from requireSupabaseAuth; RLS limits it to this seller's rows.
  supabase: SupabaseClient<Database>,
  userId: string,
  productId: string | undefined,
) {
  let query = supabase
    .from("transactions")
    .select("buyer_email, status, refunded_at, disputed_at")
    .eq("seller_id", userId);
  if (productId) query = query.eq("product_id", productId);
  const { data: txns, error } = await query;
  if (error) throw new Error(error.message);

  const { data: unsubs, error: unsubError } = await supabase
    .from("broadcast_unsubscribes")
    .select("email")
    .eq("seller_id", userId);
  if (unsubError && !isMissingTable(unsubError)) throw new Error(unsubError.message);

  return {
    recipients: selectBroadcastRecipients(txns ?? [], (unsubs ?? []).map((u) => u.email)),
    unsubscribedCount: unsubs?.length ?? 0,
    migrationMissing: isMissingTable(unsubError),
  };
}

export const getBroadcastComposer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const audience = await loadAudience(context.supabase, context.userId, data.productId);

    const since = new Date(Date.now() - BROADCAST_LIMITS.windowMs).toISOString();
    const { data: recent, error: recentError } = await context.supabase
      .from("broadcasts")
      .select("id, subject, recipient_count, created_at")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const migrationMissing = audience.migrationMissing || isMissingTable(recentError);
    if (recentError && !isMissingTable(recentError)) throw new Error(recentError.message);

    const quota = broadcastQuota(
      (recent ?? []).map((r) => r.created_at).filter((t) => t >= since),
      Date.now(),
    );

    const { unsubscribeSecret } = await import("@/lib/unsubscribe.server");
    return {
      ready: !migrationMissing && !!process.env.RESEND_API_KEY && !!unsubscribeSecret(),
      migrationMissing,
      emailConfigured: !!process.env.RESEND_API_KEY,
      audienceCount: audience.recipients.length,
      unsubscribedCount: audience.unsubscribedCount,
      maxRecipients: BROADCAST_LIMITS.maxRecipients,
      quota,
      recent: (recent ?? []).slice(0, 5),
    };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid().optional(),
        subject: z.string().trim().min(1, "Add a subject").max(BROADCAST_LIMITS.subjectMax),
        body: z.string().trim().min(1, "Write a message").max(BROADCAST_LIMITS.bodyMax),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { unsubscribeSecret } = await import("@/lib/unsubscribe.server");
    const secret = unsubscribeSecret();
    if (!secret) throw new Error("Broadcasts aren't configured on this server yet.");
    if (!process.env.RESEND_API_KEY) throw new Error("Email sending isn't configured on this server yet.");

    if (data.productId) {
      const { data: owned } = await context.supabase
        .from("products")
        .select("id")
        .eq("id", data.productId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!owned) throw new Error("Product not found");
    }

    // Quota is checked against what's actually recorded, not anything the client says.
    const since = new Date(Date.now() - BROADCAST_LIMITS.windowMs).toISOString();
    const { data: recent, error: recentError } = await context.supabase
      .from("broadcasts")
      .select("created_at")
      .eq("seller_id", context.userId)
      .gte("created_at", since);
    if (isMissingTable(recentError)) {
      throw new Error("Emailing buyers needs a quick database update first (migration 0017).");
    }
    if (recentError) throw new Error(recentError.message);
    const quota = broadcastQuota((recent ?? []).map((r) => r.created_at), Date.now());
    if (quota.remaining === 0) {
      throw new Error(
        `You've sent ${BROADCAST_LIMITS.maxPerWindow} updates in the last 24 hours. You can send again after ${new Date(
          quota.nextAvailableAt as string,
        ).toUTCString()}.`,
      );
    }

    const { recipients } = await loadAudience(context.supabase, context.userId, data.productId);
    if (recipients.length === 0) throw new Error("There's nobody to email yet — this goes to people who bought.");
    if (recipients.length > BROADCAST_LIMITS.maxRecipients) {
      throw new Error(
        `This audience is ${recipients.length} buyers; updates are limited to ${BROADCAST_LIMITS.maxRecipients} per send for now. Narrow it to one product.`,
      );
    }

    // Recorded BEFORE sending, so a send that fails part-way still counts and
    // can't be retried into a flood.
    const { error: insertError } = await context.supabase.from("broadcasts").insert({
      seller_id: context.userId,
      product_id: data.productId ?? null,
      subject: data.subject,
      body: data.body,
      recipient_count: recipients.length,
    });
    if (insertError) throw new Error(insertError.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name, handle, support_email")
      .eq("id", context.userId)
      .maybeSingle();
    const sellerName = profile?.display_name || profile?.handle || "A creator";
    const claimEmail = typeof context.claims.email === "string" ? context.claims.email : null;
    const replyTo = profile?.support_email || claimEmail;

    const messages = await Promise.all(
      recipients.map(async (to) => {
        const token = encodeURIComponent(await signUnsubscribeToken(context.userId, to, secret));
        // People click the page (it asks to confirm, so a link scanner
        // prefetching it can't unsubscribe anyone); mail clients' one-click
        // button POSTs to the API route.
        const unsubscribeUrl = `${BASE_URL}/unsubscribe?t=${token}`;
        const oneClickUrl = `${BASE_URL}/api/public/unsubscribe?t=${token}`;
        const email = buildBroadcastEmail({ sellerName, subject: data.subject, body: data.body, unsubscribeUrl });
        return { to, ...email, oneClickUrl };
      }),
    );

    const sent = await sendBroadcastEmails({ fromName: sellerName, replyTo, messages });
    return { attempted: recipients.length, sent };
  });

// --- Public: the buyer side of an unsubscribe link (no login) ---------------

export const describeUnsubscribe = createServerFn({ method: "GET" })
  .validator((data) => z.object({ token: z.string().min(1).max(2000) }).parse(data))
  .handler(async ({ data }) => {
    const { readUnsubscribeToken } = await import("@/lib/unsubscribe.server");
    const parsed = await readUnsubscribeToken(data.token);
    if (!parsed) return { valid: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, handle")
      .eq("id", parsed.sellerId)
      .maybeSingle();
    return {
      valid: true as const,
      sellerName: profile?.display_name || profile?.handle || "this creator",
      email: parsed.email,
    };
  });

export const confirmUnsubscribe = createServerFn({ method: "POST" })
  .validator((data) => z.object({ token: z.string().min(1).max(2000) }).parse(data))
  .handler(async ({ data }) => {
    const { readUnsubscribeToken, applyUnsubscribe } = await import("@/lib/unsubscribe.server");
    if (!(await readUnsubscribeToken(data.token))) throw new Error("This unsubscribe link isn't valid.");
    // Upsert underneath: clicking twice is harmless.
    if (!(await applyUnsubscribe(data.token))) {
      throw new Error("Couldn't unsubscribe just now — please try the link again.");
    }
    return { ok: true };
  });
