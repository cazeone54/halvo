import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BASE_URL } from "@/lib/site";
import { unsubscribeSecret } from "@/lib/unsubscribe.server";
import {
  GRACE_DAYS,
  intervalLabel,
  signManageToken,
  subscriptionAccess,
  type AccessState,
  type SubscriptionKind,
} from "@/lib/recurring";
import { sendBillingLinkEmail, sendPaymentFailedEmail, sendPurchaseConfirmationEmail } from "@/lib/email.server";

type Admin = SupabaseClient<Database>;

// Marks subscriptions Halvo created for buyers, so the webhook can tell them
// apart from sellers' own Halvo plan subscriptions.
export const BUYER_SUB_KIND = "buyer";

export function billingSecret(): string {
  const secret = unsubscribeSecret();
  if (!secret) throw new Error("Server misconfigured: no signing secret for billing links");
  return secret;
}

export async function manageUrl(rowId: string): Promise<string> {
  return `${BASE_URL}/billing?t=${encodeURIComponent(await signManageToken(rowId, billingSecret()))}`;
}

export function planLabel(kind: string, amountCents: number, interval: string, installmentsTotal: number | null) {
  const amount = `$${(amountCents / 100).toFixed(2)}`;
  return kind === "installments"
    ? `payment plan, ${installmentsTotal} × ${amount} monthly`
    : `membership, ${amount} per ${intervalLabel(interval)}`;
}

// The Stripe Product recurring prices hang off. Created once per Halvo product;
// if the column isn't there yet, a fresh one each time still works.
export async function ensureStripeProduct(
  admin: Admin,
  stripe: Stripe,
  product: { id: string; name: string; stripe_product_id?: string | null },
): Promise<string> {
  if (product.stripe_product_id) return product.stripe_product_id;
  const created = await stripe.products.create({ name: product.name, metadata: { halvo_product_id: product.id } });
  await admin.from("products").update({ stripe_product_id: created.id }).eq("id", product.id);
  return created.id;
}

export function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  return typeof sub === "string" ? sub : (sub?.id ?? null);
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const end = sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

async function paidInstallments(admin: Admin, rowId: string): Promise<number> {
  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("buyer_subscription_id", rowId)
    .eq("status", "success")
    .is("refunded_at", null);
  return count ?? 0;
}

export async function accessForSubscriptionRow(admin: Admin, rowId: string, now = new Date()): Promise<AccessState | null> {
  const { data: row } = await admin.from("buyer_subscriptions").select("*").eq("id", rowId).maybeSingle();
  if (!row) return null;
  return subscriptionAccess(
    {
      kind: row.kind as SubscriptionKind,
      status: row.status,
      installments_total: row.installments_total,
      installments_paid: await paidInstallments(admin, row.id),
      current_period_end: row.current_period_end,
      past_due_since: row.past_due_since,
    },
    now,
  );
}

// Keeps our row in step with Stripe's view of the subscription.
export async function syncSubscriptionRow(admin: Admin, sub: Stripe.Subscription): Promise<void> {
  await admin
    .from("buyer_subscriptions")
    .update({
      status: sub.status,
      current_period_end: periodEnd(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
      ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
    })
    .eq("stripe_subscription_id", sub.id);
}

async function invoicePaymentIntentId(stripe: Stripe, invoiceId: string): Promise<string | null> {
  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 5 });
  for (const p of payments.data) {
    if (p.status !== "paid") continue;
    const pi = p.payment.payment_intent;
    if (pi) return typeof pi === "string" ? pi : pi.id;
  }
  return null;
}

// Records one paid invoice of a buyer subscription: creates the subscription
// row on the first one, then a transaction per invoice. Idempotent on the
// invoice's PaymentIntent, so the browser and the webhook can both call it.
// Returns the transaction to send the buyer to (always the first one, so a
// buyer's link never changes).
export async function recordPaidInvoice(
  admin: Admin,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  opts: { buyerEmail?: string; buyerId?: string | null; termsAckedAt?: string | null } = {},
): Promise<{ transactionId: string; rowId: string } | null> {
  if (invoice.status !== "paid" || !invoice.id) return null;
  const subId = subscriptionIdOfInvoice(invoice);
  if (!subId) return null;
  const sub = await stripe.subscriptions.retrieve(subId);
  if (sub.metadata?.halvo_kind !== BUYER_SUB_KIND) return null;

  const productId = sub.metadata.productId;
  const { data: product } = await admin.from("products").select("id, name, owner_id").eq("id", productId).maybeSingle();
  if (!product) return null;

  const piId = await invoicePaymentIntentId(stripe, invoice.id);
  let email = opts.buyerEmail?.toLowerCase();
  if (!email && piId) {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
    email = (pi.receipt_email ?? charge?.billing_details?.email ?? undefined)?.toLowerCase();
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const kind = sub.metadata.kind === "installments" ? "installments" : "membership";
  const installmentsTotal = kind === "installments" ? Number(sub.metadata.installments_total) || null : null;
  const item = sub.items.data[0];

  // Subscription row (first writer creates it).
  let { data: row } = await admin
    .from("buyer_subscriptions")
    .select("id, buyer_email")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  let isNewRow = false;
  if (!row) {
    const { data: inserted, error } = await admin
      .from("buyer_subscriptions")
      .insert({
        product_id: product.id,
        seller_id: product.owner_id,
        buyer_email: email ?? "unknown@buyer.reconciled",
        buyer_id: opts.buyerId ?? null,
        kind,
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
        status: sub.status,
        amount_cents: item?.price?.unit_amount ?? invoice.amount_paid,
        billing_interval: item?.price?.recurring?.interval ?? "month",
        installments_total: installmentsTotal,
        current_period_end: periodEnd(sub),
        cancel_at_period_end: sub.cancel_at_period_end,
      })
      .select("id, buyer_email")
      .single();
    if (error) {
      if (error.code !== "23505") throw new Error(error.message);
      ({ data: row } = await admin
        .from("buyer_subscriptions")
        .select("id, buyer_email")
        .eq("stripe_subscription_id", sub.id)
        .single());
    } else {
      row = inserted;
      isNewRow = true;
    }
  }
  if (!row) return null;

  // The browser knows the real email even if the webhook got there first.
  if (email && row.buyer_email.endsWith("@buyer.reconciled")) {
    await admin.from("buyer_subscriptions").update({ buyer_email: email }).eq("id", row.id);
    row.buyer_email = email;
  }
  // A successful payment ends any grace period.
  await admin
    .from("buyer_subscriptions")
    .update({ past_due_since: null, status: sub.status, current_period_end: periodEnd(sub) })
    .eq("id", row.id);

  // The transaction for this invoice.
  const isFirst = invoice.billing_reason === "subscription_create";
  if (piId) {
    const { error: txError } = await admin.from("transactions").insert({
      product_id: product.id,
      seller_id: product.owner_id,
      buyer_id: opts.buyerId ?? null,
      buyer_email: row.buyer_email,
      status: "success",
      amount_paid_cents: invoice.amount_paid,
      stripe_payment_intent_id: piId,
      terms_acked_at: isFirst ? (opts.termsAckedAt ?? null) : null,
      buyer_subscription_id: row.id,
      is_renewal: !isFirst,
    });
    if (txError && txError.code !== "23505") throw new Error(txError.message);
  }

  const { data: first } = await admin
    .from("transactions")
    .select("id")
    .eq("buyer_subscription_id", row.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!first) return null;

  if (isNewRow) {
    const amount = item?.price?.unit_amount ?? invoice.amount_paid;
    await sendPurchaseConfirmationEmail({
      buyerEmail: row.buyer_email,
      productName: product.name,
      transactionId: first.id,
      amountCents: invoice.amount_paid,
    });
    await sendBillingLinkEmail({
      buyerEmail: row.buyer_email,
      productName: product.name,
      planLabel: planLabel(kind, amount, item?.price?.recurring?.interval ?? "month", installmentsTotal),
      manageUrl: await manageUrl(row.id),
    });
  }
  return { transactionId: first.id, rowId: row.id };
}

// A payment failed: start the grace period (once) and tell the buyer.
export async function recordFailedInvoice(admin: Admin, invoice: Stripe.Invoice): Promise<void> {
  const subId = subscriptionIdOfInvoice(invoice);
  if (!subId) return;
  // The very first payment failing just means checkout didn't complete.
  if (invoice.billing_reason === "subscription_create") return;
  const { data: row } = await admin
    .from("buyer_subscriptions")
    .select("id, buyer_email, past_due_since, product_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!row || row.past_due_since) return;

  const since = new Date();
  await admin.from("buyer_subscriptions").update({ past_due_since: since.toISOString() }).eq("id", row.id);
  const { data: product } = row.product_id
    ? await admin.from("products").select("name").eq("id", row.product_id).maybeSingle()
    : { data: null };
  await sendPaymentFailedEmail({
    buyerEmail: row.buyer_email,
    productName: product?.name ?? "your purchase",
    manageUrl: await manageUrl(row.id),
    graceEndsAt: new Date(since.getTime() + GRACE_DAYS * 86_400_000).toISOString(),
  });
}

// Stripe's customer portal, configured once for Halvo buyers. Memberships may
// be cancelled there; payment plans may not (that would just forfeit access).
export async function portalConfiguration(stripe: Stripe, allowCancel: boolean): Promise<string> {
  const tag = allowCancel ? "halvo_buyer_membership" : "halvo_buyer_plan";
  const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const found = existing.data.find((c) => c.metadata?.halvo === tag);
  if (found) return found.id;
  const created = await stripe.billingPortal.configurations.create({
    metadata: { halvo: tag },
    business_profile: { headline: allowCancel ? "Manage your membership" : "Manage your payment plan" },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: allowCancel ? { enabled: true, mode: "at_period_end" } : { enabled: false },
    },
  });
  return created.id;
}
