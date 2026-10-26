import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isFreeProduct } from "@/lib/checkout-math";
import { BODY_MAX, SEQUENCE_DEFAULTS, SUBJECT_MAX } from "@/lib/email-sequence";

// Before migration 0029 the columns and tables don't exist (or lack their
// grants). Every seller-facing read degrades to "not switched on yet", and
// every public read to "nothing extra", so no page ever breaks over it.
function notMigrated(error: { code?: string; message: string } | null): boolean {
  return (
    !!error &&
    (error.code === "42703" ||
      error.code === "42P01" ||
      error.code === "42501" ||
      /schema cache|column .* does not exist|could not find the table|permission denied/i.test(error.message))
  );
}

const DAY = 24 * 60 * 60 * 1000;

type Client = import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;

// A coupon the seller can attach to an offer: theirs, switched on, not expired,
// and not tied to a different product.
async function assertUsableCoupon(supabase: Client, userId: string, code: string, productId: string) {
  const { data: c } = await supabase
    .from("coupons")
    .select("code, active, expires_at, product_id")
    .eq("owner_id", userId)
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!c || !c.active) throw new Error(`There's no active coupon called ${code.toUpperCase()}.`);
  if (c.expires_at && new Date(c.expires_at) <= new Date()) throw new Error(`Coupon ${c.code} has already ended.`);
  if (c.product_id && c.product_id !== productId) throw new Error(`Coupon ${c.code} only works on a different product.`);
  return c.code;
}

// A paid product of the seller's own, published, sold as a single payment.
async function assertOfferProduct(supabase: Client, userId: string, productId: string) {
  const { data: p } = await supabase
    .from("products")
    .select("id, url_slug, price_cents, pay_what_you_want, billing_type")
    .eq("id", productId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!p || !p.url_slug) throw new Error("Pick one of your published products.");
  if (isFreeProduct(p)) throw new Error("Pick a paid product. Free ones are for the Start here spot.");
  if (p.billing_type === "membership") throw new Error("Pick a one-off product, not a membership.");
}

export const getMyFunnelSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileRes, seqRes, couponsRes, sendsRes] = await Promise.all([
      context.supabase.from("profiles").select("offer_product_id, offer_coupon_code").eq("id", context.userId).single(),
      context.supabase.from("email_sequences").select("*").eq("seller_id", context.userId).maybeSingle(),
      context.supabase
        .from("coupons")
        .select("code, percent_off, amount_off_cents, expires_at, product_id, active")
        .eq("owner_id", context.userId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("sequence_sends")
        .select("step")
        .eq("seller_id", context.userId)
        .gte("sent_at", new Date(Date.now() - 30 * DAY).toISOString()),
    ]);
    const available = !notMigrated(profileRes.error) && !notMigrated(seqRes.error);
    const seq = seqRes.data;
    const now = Date.now();
    return {
      available,
      offer: {
        productId: profileRes.data?.offer_product_id ?? null,
        couponCode: profileRes.data?.offer_coupon_code ?? null,
      },
      sequence: {
        enabled: seq?.enabled ?? false,
        step2Subject: seq?.step2_subject || SEQUENCE_DEFAULTS.step2Subject,
        step2Body: seq?.step2_body || SEQUENCE_DEFAULTS.step2Body,
        step3Subject: seq?.step3_subject || SEQUENCE_DEFAULTS.step3Subject,
        step3Body: seq?.step3_body || SEQUENCE_DEFAULTS.step3Body,
        step3ProductId: seq?.step3_product_id ?? null,
        step3CouponCode: seq?.step3_coupon_code ?? null,
      },
      coupons: (couponsRes.data ?? []).filter((c) => !c.expires_at || Date.parse(c.expires_at) > now),
      sentLast30: {
        step2: (sendsRes.data ?? []).filter((s) => s.step === 2).length,
        step3: (sendsRes.data ?? []).filter((s) => s.step === 3).length,
      },
    };
  });

export const updateMyOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({ productId: z.string().uuid().nullable(), couponCode: z.string().trim().max(32).nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let code: string | null = null;
    if (data.productId) {
      await assertOfferProduct(context.supabase, context.userId, data.productId);
      if (data.couponCode) code = await assertUsableCoupon(context.supabase, context.userId, data.couponCode, data.productId);
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ offer_product_id: data.productId, offer_coupon_code: code })
      .eq("id", context.userId);
    if (error) {
      if (notMigrated(error)) throw new Error("This isn't switched on yet. Please try again a little later.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateMySequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        enabled: z.boolean(),
        step2Subject: z.string().trim().min(1, "Email 2 needs a subject.").max(SUBJECT_MAX),
        step2Body: z.string().trim().min(1, "Email 2 needs some text.").max(BODY_MAX),
        step3Subject: z.string().trim().min(1, "Email 3 needs a subject.").max(SUBJECT_MAX),
        step3Body: z.string().trim().min(1, "Email 3 needs some text.").max(BODY_MAX),
        step3ProductId: z.string().uuid().nullable(),
        step3CouponCode: z.string().trim().max(32).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let code: string | null = null;
    if (data.step3ProductId) {
      await assertOfferProduct(context.supabase, context.userId, data.step3ProductId);
      if (data.step3CouponCode) {
        code = await assertUsableCoupon(context.supabase, context.userId, data.step3CouponCode, data.step3ProductId);
      }
    }

    const { data: existing, error: readError } = await context.supabase
      .from("email_sequences")
      .select("enabled, enabled_at")
      .eq("seller_id", context.userId)
      .maybeSingle();
    if (notMigrated(readError)) throw new Error("Follow-up emails aren't switched on yet. Please try again a little later.");

    // enabled_at only moves when the sequence is switched on, so turning it off
    // and on again never reaches back to downloads from while it was off.
    const enabledAt = data.enabled ? (existing?.enabled && existing.enabled_at ? existing.enabled_at : new Date().toISOString()) : existing?.enabled_at ?? null;

    const { error } = await context.supabase.from("email_sequences").upsert({
      seller_id: context.userId,
      enabled: data.enabled,
      enabled_at: enabledAt,
      step2_subject: data.step2Subject,
      step2_body: data.step2Body,
      step3_subject: data.step3Subject,
      step3_body: data.step3Body,
      step3_product_id: data.step3ProductId,
      step3_coupon_code: code,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public, fire-and-forget: one visit to a seller's page per browser session.
// The top of the funnel. Never fails the page.
export const recordShopView = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        handle: z.string().max(32),
        referrer: z.string().max(2000).optional(),
        utmSource: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sourceFromArrival } = await import("@/lib/record-source.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("handle", data.handle.toLowerCase())
        .maybeSingle();
      if (profile) {
        await supabaseAdmin
          .from("shop_views")
          .insert({ seller_id: profile.id, source: sourceFromArrival({ referrer: data.referrer, utmSource: data.utmSource }) });
      }
    } catch {
      // Analytics only.
    }
    return { ok: true };
  });

// The funnel for the last 30 days: visits → link taps → product views → free
// downloads → sales. Sources are only named once there are enough visits for
// the split to mean something (see the note in analytics.functions.ts).
export const getMyFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const count = async (q: PromiseLike<{ count: number | null; error: { code?: string; message: string } | null }>) => {
      const { count: n, error } = await q;
      return error ? null : n ?? 0;
    };
    const [visits, taps, productViews, freeDownloads, sales, sources] = await Promise.all([
      count(context.supabase.from("shop_views").select("id", { count: "exact", head: true }).eq("seller_id", context.userId).gte("created_at", since)),
      count(context.supabase.from("link_clicks").select("id", { count: "exact", head: true }).eq("profile_id", context.userId).gte("created_at", since)),
      // RLS on product_views already limits this to the seller's own products.
      count(context.supabase.from("product_views").select("id", { count: "exact", head: true }).gte("created_at", since)),
      count(
        context.supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", context.userId)
          .eq("status", "success")
          .eq("amount_paid_cents", 0)
          .gte("created_at", since),
      ),
      count(
        context.supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", context.userId)
          .eq("status", "success")
          .gt("amount_paid_cents", 0)
          .gte("created_at", since),
      ),
      context.supabase.from("shop_views").select("source").eq("seller_id", context.userId).gte("created_at", since).limit(5000),
    ]);

    let topSource: { name: string; share: number } | null = null;
    const rows = sources.error ? [] : sources.data ?? [];
    if (rows.length >= 30) {
      const tally = new Map<string, number>();
      for (const r of rows) tally.set(r.source ?? "Unknown", (tally.get(r.source ?? "Unknown") ?? 0) + 1);
      const [name, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
      topSource = { name, share: n / rows.length };
    }
    return { visits, taps, productViews, freeDownloads, sales, topSource };
  });
