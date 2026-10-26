import { BASE_URL, BRAND_NAME } from "@/lib/site";
import { buildSequenceEmail, describeCode, fillPlaceholders, nextDueStep, SEQUENCE_WINDOW_DAYS } from "@/lib/email-sequence";
import { couponLink } from "@/lib/coupon-link";
import { isFreeProduct } from "@/lib/checkout-math";
import { formatCents } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;
// One run never sends more than this, so a bug or a sudden backlog can't burn
// through the email provider's daily allowance in one go.
const MAX_PER_RUN = 300;

export type SequenceRunResult = {
  sellers: number;
  due: number;
  sent: number;
  dryRun: boolean;
  skippedReason?: string;
};

const missingTable = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "42703" || /schema cache|could not find the table|does not exist/i.test(e.message));

/**
 * Sends whatever follow-up emails are due. Called once an hour.
 *
 * Each email is claimed in sequence_sends (unique per download and step)
 * BEFORE it is sent. If sending then fails, that email is lost rather than
 * retried: a missed follow-up costs a little, a duplicate costs the seller's
 * reputation with that buyer.
 *
 * dryRun counts what's due without claiming or sending anything.
 */
export async function runEmailSequences(opts: { now?: Date; dryRun?: boolean } = {}): Promise<SequenceRunResult> {
  const now = opts.now ?? new Date();
  const dryRun = !!opts.dryRun;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { unsubscribeSecret } = await import("@/lib/unsubscribe.server");
  const { signUnsubscribeToken } = await import("@/lib/broadcast");
  const { sendBroadcastEmails } = await import("@/lib/email.server");
  const { findValidCoupon } = await import("@/lib/coupons.functions");
  const { sellerCanTakePayments } = await import("@/lib/seller-visibility.server");

  const result: SequenceRunResult = { sellers: 0, due: 0, sent: 0, dryRun };
  const secret = unsubscribeSecret();
  if (!secret) return { ...result, skippedReason: "no unsubscribe signing secret" };
  if (!dryRun && !process.env.RESEND_API_KEY) return { ...result, skippedReason: "email not configured" };

  const { data: sequences, error } = await supabaseAdmin.from("email_sequences").select("*").eq("enabled", true);
  if (error) {
    if (missingTable(error)) return { ...result, skippedReason: "migration 0029 not applied" };
    throw new Error(error.message);
  }

  for (const seq of sequences ?? []) {
    if (result.sent >= MAX_PER_RUN) break;
    if (!seq.enabled_at) continue;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, handle, support_email, deactivated_at")
      .eq("id", seq.seller_id)
      .maybeSingle();
    if (!profile || profile.deactivated_at) continue;
    const sellerName = profile.display_name || profile.handle || "A creator on " + BRAND_NAME;

    // Only downloads made after the seller switched this on, and recent ones.
    const windowStart = now.getTime() - SEQUENCE_WINDOW_DAYS * DAY;
    const since = new Date(Math.max(Date.parse(seq.enabled_at), windowStart)).toISOString();
    const { data: claims } = await supabaseAdmin
      .from("transactions")
      .select("id, buyer_email, created_at, products(name)")
      .eq("seller_id", seq.seller_id)
      .eq("amount_paid_cents", 0)
      .eq("status", "success")
      .is("refunded_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (!claims?.length) continue;
    result.sellers += 1;

    const [{ data: sends }, { data: unsubs }] = await Promise.all([
      supabaseAdmin
        .from("sequence_sends")
        .select("transaction_id, step, sent_at")
        .in(
          "transaction_id",
          claims.map((c) => c.id),
        ),
      supabaseAdmin.from("broadcast_unsubscribes").select("email").eq("seller_id", seq.seller_id),
    ]);
    const unsubscribed = new Set((unsubs ?? []).map((u) => u.email.trim().toLowerCase()));
    const sent = new Map<string, Partial<Record<2 | 3, Date>>>();
    for (const s of sends ?? []) {
      const entry = sent.get(s.transaction_id) ?? {};
      entry[s.step as 2 | 3] = new Date(s.sent_at);
      sent.set(s.transaction_id, entry);
    }

    // Email 3's product: the seller's own, published, paid, and buyable now.
    let offer: { id: string; name: string; slug: string } | null = null;
    const boughtOffer = new Set<string>();
    let codeLine: string | null = null;
    let code: string | null = null;
    if (seq.step3_product_id) {
      const { data: p } = await supabaseAdmin
        .from("products")
        .select("id, name, url_slug, owner_id, price_cents, pay_what_you_want, billing_type")
        .eq("id", seq.step3_product_id)
        .maybeSingle();
      const canPay = await sellerCanTakePayments(supabaseAdmin, seq.seller_id);
      if (p && p.owner_id === seq.seller_id && p.url_slug && !isFreeProduct(p) && p.billing_type !== "membership" && canPay !== false) {
        offer = { id: p.id, name: p.name, slug: p.url_slug };
        const { data: buyers } = await supabaseAdmin
          .from("transactions")
          .select("buyer_email")
          .eq("product_id", p.id)
          .eq("status", "success")
          .gt("amount_paid_cents", 0);
        for (const b of buyers ?? []) boughtOffer.add(b.buyer_email.trim().toLowerCase());

        if (seq.step3_coupon_code) {
          const valid = await findValidCoupon(supabaseAdmin, seq.step3_coupon_code, p.id);
          if (valid) {
            const { data: c } = await supabaseAdmin.from("coupons").select("code, expires_at").eq("id", valid.id).maybeSingle();
            code = c?.code ?? seq.step3_coupon_code;
            codeLine = describeCode({
              code,
              percentOff: valid.percent_off,
              amountOffLabel: valid.amount_off_cents ? formatCents(valid.amount_off_cents) : null,
              expiresAt: c?.expires_at ?? null,
            });
          }
        }
      }
    }

    const messages: Array<{ to: string; subject: string; html: string; text: string; oneClickUrl: string }> = [];
    for (const claim of claims) {
      if (result.sent + messages.length >= MAX_PER_RUN) break;
      const to = claim.buyer_email.trim().toLowerCase();
      if (!to || to.endsWith("@buyer.reconciled") || unsubscribed.has(to)) continue;
      const step = nextDueStep({
        claimedAt: new Date(claim.created_at),
        now,
        sent: sent.get(claim.id) ?? {},
        hasOffer: !!offer && !boughtOffer.has(to),
      });
      if (!step) continue;
      result.due += 1;
      if (dryRun) continue;

      // Claim first; a conflict means another run already has it.
      const { error: claimError } = await supabaseAdmin
        .from("sequence_sends")
        .insert({ seller_id: seq.seller_id, transaction_id: claim.id, step });
      if (claimError) continue;

      const freeName = (claim.products as unknown as { name: string } | null)?.name ?? "your free download";
      const values = { product: freeName, offer: offer?.name, seller: sellerName };
      const subject = fillPlaceholders(step === 2 ? seq.step2_subject : seq.step3_subject, values);
      const body = fillPlaceholders(step === 2 ? seq.step2_body : seq.step3_body, values);
      const token = encodeURIComponent(await signUnsubscribeToken(seq.seller_id, to, secret));
      const email = buildSequenceEmail({
        sellerName,
        freeProductName: freeName,
        subject,
        body,
        unsubscribeUrl: `${BASE_URL}/unsubscribe?t=${token}`,
        cta:
          step === 3 && offer
            ? { label: `Get ${offer.name}`, url: couponLink(BASE_URL, offer.slug, code), codeLine }
            : null,
      });
      messages.push({ to, ...email, oneClickUrl: `${BASE_URL}/api/public/unsubscribe?t=${token}` });
    }

    if (messages.length > 0) {
      result.sent += await sendBroadcastEmails({
        fromName: sellerName,
        replyTo: profile.support_email ?? null,
        messages,
      });
    }
  }
  return result;
}
