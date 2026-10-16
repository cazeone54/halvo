import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { resolveOptionalUserId } from "@/lib/optional-auth.server";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { DIRECT_CHARGES, calcPlatformFeeCents } from "@/lib/plans";
import { countDeliverableFiles } from "@/lib/bundle.server";
import { recordSaleSource } from "@/lib/record-source.server";
import { assertInStock } from "@/lib/offer.server";
import { activeSalePriceCents } from "@/lib/offer";
import {
  applicationFeePercent,
  installmentAmountCents,
  installmentCancelAt,
  validateBilling,
  verifyManageToken,
} from "@/lib/recurring";
import {
  BUYER_SUB_KIND,
  accessForSubscriptionRow,
  billingSecret,
  ensureStripeProduct,
  manageUrl,
  onAccount,
  planLabel,
  portalConfiguration,
  recordPaidInvoice,
  sellerChargeAccount,
} from "@/lib/recurring.server";
import { BASE_URL, CURRENCY } from "@/lib/site";
import type Stripe from "stripe";

const UNAVAILABLE_MESSAGE = "This product isn't available for purchase yet.";

function missingMigration(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    /schema cache|column .* does not exist|could not find the table/i.test(error.message)
  );
}

// Public — starts a membership or payment plan. Like one-time checkout, the
// amount comes only from the server; the buyer confirms the first invoice's
// payment with the same Payment Element.
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ productId: z.string().uuid(), plan: z.enum(["membership", "installments"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin.from("products").select("*").eq("id", data.productId).single();
    if (!product?.url_slug || !product.owner_id) throw new Error("Product not found");

    const isMembership = product.billing_type === "membership";
    if (data.plan === "membership" && !isMembership) throw new Error("This product isn't a membership.");
    if (data.plan === "installments" && (isMembership || !product.installment_count)) {
      throw new Error("This product doesn't offer a payment plan.");
    }
    // Independent lookups, in parallel (see createProductPaymentIntent).
    const [deliverableCount, { data: seller }, tier] = await Promise.all([
      countDeliverableFiles(supabaseAdmin, product.id),
      supabaseAdmin.from("profiles").select("stripe_connect_id, deactivated_at").eq("id", product.owner_id).single(),
      resolveUserTier(supabaseAdmin, product.owner_id),
      assertInStock(supabaseAdmin, product),
    ]);
    // Deactivated sellers take no new sales — least of all a recurring one,
    // which would keep billing a buyer long after the seller stepped away.
    if (deliverableCount === 0 || !seller?.stripe_connect_id || seller.deactivated_at) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(seller.stripe_connect_id).catch(() => null);
    if (!account?.charges_enabled) throw new Error(UNAVAILABLE_MESSAGE);

    // A launch price applies to a payment plan's total; memberships bill the regular price.
    const count = product.installment_count ?? 0;
    const amountCents =
      data.plan === "membership"
        ? product.price_cents
        : installmentAmountCents(activeSalePriceCents(product, new Date()) ?? product.price_cents, count);
    const interval = data.plan === "membership" && product.billing_interval === "year" ? "year" : "month";
    const problem = validateBilling({
      billingType: isMembership ? "membership" : "one_time",
      billingInterval: isMembership ? interval : null,
      installmentCount: isMembership ? null : count,
      priceCents: product.price_cents,
      payWhatYouWant: product.pay_what_you_want,
    });
    if (problem) throw new Error(UNAVAILABLE_MESSAGE);

    const feePercent = applicationFeePercent(calcPlatformFeeCents(tier, amountCents), amountCents);
    // Direct charges: the subscription, its customer and product live on the
    // seller's own account, and Halvo's cut is an application fee. (Live Stripe
    // refuses destination subscriptions for this Managed Risk platform.)
    const chargeAccount = DIRECT_CHARGES ? seller.stripe_connect_id : null;
    const opts = onAccount(chargeAccount);

    try {
      const stripeProductId = await ensureStripeProduct(supabaseAdmin, stripe, product, chargeAccount);
      const customer = await stripe.customers.create({ metadata: { halvo_product_id: product.id } }, opts);
      const sub = await stripe.subscriptions.create(
        {
          customer: customer.id,
          items: [
            { price_data: { currency: CURRENCY, product: stripeProductId, unit_amount: amountCents, recurring: { interval } } },
          ],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.confirmation_secret"],
          ...(chargeAccount
            ? {}
            : { transfer_data: { destination: seller.stripe_connect_id }, on_behalf_of: seller.stripe_connect_id }),
          application_fee_percent: feePercent,
          metadata: {
            halvo_kind: BUYER_SUB_KIND,
            productId: product.id,
            kind: data.plan,
            ...(data.plan === "installments" ? { installments_total: String(count) } : {}),
          },
        },
        opts,
      );
      // A payment plan ends itself after its last payment. Set once the real
      // billing anchor is known (see installmentCancelAt); if that fails, the
      // plan is cancelled rather than left to charge indefinitely.
      if (data.plan === "installments") {
        try {
          await stripe.subscriptions.update(
            sub.id,
            {
              cancel_at: installmentCancelAt(new Date(sub.billing_cycle_anchor * 1000), count),
              proration_behavior: "none",
            },
            opts,
          );
        } catch (error) {
          await stripe.subscriptions.cancel(sub.id, undefined, opts).catch(() => {});
          throw error;
        }
      }
      const invoice = sub.latest_invoice as Stripe.Invoice | null;
      const clientSecret = invoice?.confirmation_secret?.client_secret;
      if (!clientSecret) throw new Error("Could not start checkout.");
      return { clientSecret, subscriptionId: sub.id, amountCents, stripeAccount: chargeAccount };
    } catch (error) {
      throw new Error(getStripeErrorMessage(error));
    }
  });

// Public — called right after the buyer's first payment succeeds. Everything
// is re-read from Stripe; the webhook does the same if the browser never calls.
export const recordSubscriptionPurchase = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        subscriptionId: z.string().startsWith("sub_"),
        productId: z.string().uuid(),
        // Absent when finishing after a payment-app redirect with no saved
        // checkout; the invoice's own email is used then.
        buyerEmail: z.string().email().optional(),
        acknowledgedTerms: z.boolean().optional(),
        referrer: z.string().max(500).optional(),
        utmSource: z.string().max(100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripeClient();
    // The subscription lives on the product owner's account (direct charges),
    // so resolve the product first and look it up there.
    const { data: product } = await supabaseAdmin.from("products").select("owner_id").eq("id", data.productId).single();
    const account = await sellerChargeAccount(supabaseAdmin, product?.owner_id ?? null);
    const opts = onAccount(account);
    const sub = await stripe.subscriptions.retrieve(data.subscriptionId, { expand: ["latest_invoice"] }, opts);
    if (sub.metadata?.halvo_kind !== BUYER_SUB_KIND || sub.metadata.productId !== data.productId) {
      throw new Error("Payment does not match this product.");
    }
    const invoice = sub.latest_invoice as Stripe.Invoice | null;
    if (!invoice || invoice.status !== "paid") throw new Error("Payment has not succeeded yet.");

    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (data.buyerEmail) {
      await stripe.customers.update(customerId, { email: data.buyerEmail }, opts).catch(() => {});
    }

    const result = await recordPaidInvoice(supabaseAdmin, stripe, invoice, {
      buyerEmail: data.buyerEmail,
      buyerId: await resolveOptionalUserId(),
      termsAckedAt: data.acknowledgedTerms ? new Date().toISOString() : null,
      account,
    });
    if (!result) throw new Error("Could not record purchase");

    await recordSaleSource({
      transactionId: result.transactionId,
      sellerId: product?.owner_id ?? null,
      referrer: data.referrer,
      utmSource: data.utmSource,
    });
    return { transactionId: result.transactionId };
  });

export const setProductBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        billingType: z.enum(["one_time", "membership"]),
        billingInterval: z.enum(["month", "year"]).nullable(),
        installmentCount: z.number().int().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: product } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!product) throw new Error("Product not found");

    const problem = validateBilling({
      billingType: data.billingType,
      billingInterval: data.billingType === "membership" ? data.billingInterval : null,
      installmentCount: data.billingType === "membership" ? null : data.installmentCount,
      priceCents: product.price_cents,
      payWhatYouWant: product.pay_what_you_want,
    });
    if (problem) throw new Error(problem);
    if (data.billingType === "membership" && product.sale_price_cents != null) {
      throw new Error("Remove the launch price first — memberships bill the regular price every period.");
    }

    const { error } = await context.supabase
      .from("products")
      .update({
        billing_type: data.billingType,
        billing_interval: data.billingType === "membership" ? data.billingInterval : null,
        installment_count: data.billingType === "membership" ? null : data.installmentCount,
      })
      .eq("id", product.id)
      .eq("owner_id", context.userId);
    if (error) {
      if (missingMigration(error)) {
        throw new Error("Memberships and payment plans need database migration 0020 — apply it in the Supabase SQL editor.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

async function rowFromToken(token: string) {
  const id = await verifyManageToken(token, billingSecret());
  if (!id) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("buyer_subscriptions").select("*").eq("id", id).maybeSingle();
  return row ? { row, admin: supabaseAdmin } : null;
}

// Public, via the signed link in the buyer's email.
export const describeBilling = createServerFn({ method: "GET" })
  .validator((data) => z.object({ token: z.string().min(10).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const found = await rowFromToken(data.token);
    if (!found) return null;
    const { row, admin } = found;
    const { data: product } = row.product_id
      ? await admin.from("products").select("name").eq("id", row.product_id).maybeSingle()
      : { data: null };
    const { count: paid } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("buyer_subscription_id", row.id)
      .eq("status", "success")
      .is("refunded_at", null);
    const { data: first } = await admin
      .from("transactions")
      .select("id")
      .eq("buyer_subscription_id", row.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      productName: product?.name ?? "Your purchase",
      kind: row.kind,
      planLabel: planLabel(row.kind, row.amount_cents, row.billing_interval, row.installments_total),
      paidCount: paid ?? 0,
      installmentsTotal: row.installments_total,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      access: await accessForSubscriptionRow(admin, row.id),
      downloadTransactionId: first?.id ?? null,
    };
  });

export const openBillingPortal = createServerFn({ method: "POST" })
  .validator((data) => z.object({ token: z.string().min(10).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const found = await rowFromToken(data.token);
    if (!found) throw new Error("This link isn't valid.");
    const stripe = getStripeClient();
    try {
      // The buyer's customer record lives where the subscription does: on the
      // seller's account under direct charges.
      const account = await sellerChargeAccount(found.admin, found.row.seller_id);
      const session = await stripe.billingPortal.sessions.create(
        {
          customer: found.row.stripe_customer_id,
          configuration: await portalConfiguration(stripe, found.row.kind === "membership", account),
          return_url: `${BASE_URL}/billing?t=${encodeURIComponent(data.token)}`,
        },
        onAccount(account),
      );
      return { url: session.url };
    } catch (error) {
      throw new Error(getStripeErrorMessage(error));
    }
  });

// Public — for the download page: is this purchase part of a membership or
// plan, and where does the buyer manage it? Same trust level as the page itself.
export const getBillingForTransaction = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin.from("transactions").select("*").eq("id", data.transactionId).maybeSingle();
    if (error || !tx?.buyer_subscription_id) return null;
    const { data: row } = await supabaseAdmin
      .from("buyer_subscriptions")
      .select("*")
      .eq("id", tx.buyer_subscription_id)
      .maybeSingle();
    if (!row) return null;
    return {
      planLabel: planLabel(row.kind, row.amount_cents, row.billing_interval, row.installments_total),
      manageUrl: await manageUrl(row.id),
      access: await accessForSubscriptionRow(supabaseAdmin, row.id),
    };
  });

export const listMyBuyerSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("buyer_subscriptions")
      .select("id, product_id, buyer_email, kind, status, amount_cents, billing_interval, installments_total, current_period_end, cancel_at_period_end, past_due_since, created_at")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (missingMigration(error)) return { subscriptions: [], migrationMissing: true };
      throw new Error(error.message);
    }
    return { subscriptions: data ?? [], migrationMissing: false };
  });
