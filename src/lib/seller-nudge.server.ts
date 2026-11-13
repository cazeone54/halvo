import { BASE_URL } from "@/lib/site";
import { isFreeProduct } from "@/lib/checkout-math";
import { buildNudgeEmail, firstNameOf, nextNudge, type NudgeKind, type NudgeVariant } from "@/lib/seller-nudge";

// Off until the owner has read the emails and said yes: until then a run only
// reports who would get what. Flip to true to start sending.
export const SELLER_NUDGES_LIVE = false;

// One run never sends more than this, whatever the backlog.
const MAX_PER_RUN = 100;

export type NudgeRunResult = {
  sellers: number;
  due: Array<{ email: string; variant: NudgeVariant; product: string | null }>;
  sent: number;
  dryRun: boolean;
  skippedReason?: string;
};

const missingTable = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === "42P01" || /schema cache|could not find the table|does not exist/i.test(e.message));

const masked = (e: string) => `${e.slice(0, 2)}…@${e.split("@")[1] ?? ""}`;

/**
 * Sends whatever seller reminders are due (see seller-nudge.ts). Called once
 * an hour. Each reminder is claimed in seller_nudges (one row per seller and
 * kind) BEFORE it is sent, so a seller never gets the same one twice; if the
 * send then fails, that reminder is lost rather than retried.
 *
 * dryRun reports who is due without claiming or sending anything.
 */
export async function runSellerNudges(opts: { now?: Date; dryRun?: boolean } = {}): Promise<NudgeRunResult> {
  const now = opts.now ?? new Date();
  const dryRun = !!opts.dryRun || !SELLER_NUDGES_LIVE;
  const result: NudgeRunResult = { sellers: 0, due: [], sent: 0, dryRun };
  if (!dryRun && !process.env.RESEND_API_KEY) return { ...result, skippedReason: "email not configured" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendSellerNudgeEmail } = await import("@/lib/email.server");

  const sent = new Map<string, Partial<Record<NudgeKind, Date>>>();
  const { data: sendRows, error: sendError } = await supabaseAdmin.from("seller_nudges").select("seller_id, kind, sent_at");
  if (sendError) {
    // Without the table nothing can be recorded, so nothing is sent.
    if (!missingTable(sendError)) throw new Error(sendError.message);
    if (!dryRun) return { ...result, skippedReason: "migration 0034 not applied" };
  }
  for (const r of sendRows ?? []) sent.set(r.seller_id, { ...sent.get(r.seller_id), [r.kind as NudgeKind]: new Date(r.sent_at) });

  const users: Array<{ id: string; email?: string; created_at: string }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const [{ data: profiles }, { data: products }, { data: files }, { data: links }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, stripe_connect_id, stripe_charges_enabled, deactivated_at"),
    supabaseAdmin.from("products").select("id, owner_id, name, url_slug, price_cents, pay_what_you_want, created_at"),
    supabaseAdmin.from("product_files").select("product_id"),
    // A product can deliver a link instead of a file (migration 0033).
    supabaseAdmin.from("product_links").select("product_id"),
  ]);
  const withFile = new Set([...(files ?? []), ...(links ?? [])].map((f) => f.product_id));
  const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
  const productsOf = new Map<string, NonNullable<typeof products>>();
  for (const p of products ?? []) if (p.owner_id) productsOf.set(p.owner_id, [...(productsOf.get(p.owner_id) ?? []), p]);

  for (const user of users) {
    if (result.sent >= MAX_PER_RUN) break;
    const email = user.email?.trim().toLowerCase();
    if (!email || email.endsWith("@example.com")) continue;
    const profile = profileOf.get(user.id);
    if (!profile) continue;
    const mine = productsOf.get(user.id) ?? [];

    // Views only matter once there's a live product to have been viewed.
    let hasViews = false;
    const liveIds = mine.filter((p) => p.url_slug).map((p) => p.id);
    if (liveIds.length) {
      const { count } = await supabaseAdmin.from("product_views").select("id", { count: "exact", head: true }).in("product_id", liveIds);
      hasViews = (count ?? 0) > 0;
    }

    const due = nextNudge(
      {
        signedUpAt: new Date(user.created_at),
        stripe: profile.stripe_charges_enabled ? "ready" : profile.stripe_connect_id ? "started" : "none",
        deactivated: !!profile.deactivated_at,
        hasViews,
        sent: sent.get(user.id) ?? {},
        products: mine.map((p) => ({
          name: p.name,
          slug: p.url_slug,
          free: isFreeProduct(p),
          hasFile: withFile.has(p.id),
          createdAt: new Date(p.created_at),
        })),
      },
      now,
    );
    if (!due) continue;
    result.sellers += 1;
    result.due.push({ email: masked(email), variant: due.variant, product: due.product?.name ?? null });
    if (dryRun) continue;

    // Claim first; a conflict means another run already sent it.
    const { error: claimError } = await supabaseAdmin.from("seller_nudges").insert({ seller_id: user.id, kind: due.kind });
    if (claimError) continue;

    const message = buildNudgeEmail({
      variant: due.variant,
      firstName: firstNameOf(profile.display_name),
      productName: due.product?.name ?? null,
      productUrl: due.product?.slug ? `${BASE_URL}/p/${due.product.slug}` : null,
      dashboardUrl: `${BASE_URL}/dashboard`,
    });
    if (await sendSellerNudgeEmail({ to: email, ...message })) result.sent += 1;
  }
  return result;
}
