import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { resolveOptionalUserId } from "@/lib/optional-auth.server";
import {
  computeChargeAmountCents,
  isAboveMinimumCharge,
  enforcedMinCents,
  buildDestinationChargeParams,
} from "@/lib/checkout-math";

// Public — buyers may be signed out. Server recomputes the charge amount
// itself; never trusts a client-sent price.
export const createProductPaymentIntent = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        amountCents: z.number().int().positive().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cents, pay_what_you_want, owner_id, url_slug")
      .eq("id", data.productId)
      .single();
    if (productError || !product || !product.url_slug) {
      throw new Error("Product not found");
    }
    if (!product.owner_id) {
      throw new Error("This product has no seller and can't be purchased.");
    }

    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", product.owner_id)
      .single();
    if (!sellerProfile?.stripe_connect_id) {
      throw new Error("The seller hasn't finished connecting Stripe yet.");
    }

    const stripe = getStripeClient();
    let sellerAccount;
    try {
      sellerAccount = await stripe.accounts.retrieve(sellerProfile.stripe_connect_id);
    } catch {
      throw new Error("The seller's Stripe account isn't available right now.");
    }
    if (!sellerAccount.charges_enabled) {
      throw new Error("The seller hasn't finished Stripe onboarding yet.");
    }

    const chargeAmountCents = computeChargeAmountCents(product, data.amountCents);

    if (!isAboveMinimumCharge(chargeAmountCents)) {
      throw new Error("The charge amount is below the minimum allowed.");
    }

    try {
      const intent = await stripe.paymentIntents.create({
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: { productId: product.id, product_name: product.name },
        ...buildDestinationChargeParams(chargeAmountCents, sellerProfile.stripe_connect_id),
      });
      return { clientSecret: intent.client_secret };
    } catch (error) {
      throw new Error(getStripeErrorMessage(error));
    }
  });

// Public — records the order after the client confirms payment. Re-verifies
// everything against Stripe directly; never trusts client-reported status.
export const recordSuccessfulTransaction = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        paymentIntentId: z.string().min(1),
        productId: z.string().uuid(),
        buyerEmail: z.string().email(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripeClient();

    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("stripe_payment_intent_id", data.paymentIntentId)
      .maybeSingle();
    if (existing) return { transactionId: existing.id };

    const intent = await stripe.paymentIntents.retrieve(data.paymentIntentId);
    if (intent.status !== "succeeded") {
      throw new Error("Payment has not succeeded yet.");
    }
    if (intent.metadata.productId !== data.productId) {
      throw new Error("Payment does not match this product.");
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, price_cents, pay_what_you_want, owner_id")
      .eq("id", data.productId)
      .single();
    if (productError || !product) throw new Error("Product not found");

    if (intent.amount_received < enforcedMinCents(product)) {
      throw new Error("Payment amount is below the required minimum for this product.");
    }

    const buyerId = await resolveOptionalUserId();

    const { data: transaction, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        product_id: product.id,
        seller_id: product.owner_id,
        buyer_id: buyerId,
        buyer_email: data.buyerEmail.toLowerCase(),
        status: "success",
        amount_paid_cents: intent.amount_received,
        stripe_payment_intent_id: intent.id,
      })
      .select("id")
      .single();
    if (insertError || !transaction) throw new Error(insertError?.message ?? "Could not record purchase");

    return { transactionId: transaction.id };
  });

// Public — the success page's loader. Returns only non-PII fields.
export const getVerifiedTransaction = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .select("id, status, refunded_at, amount_paid_cents, product_id, products(name)")
      .eq("id", data.transactionId)
      .single();
    if (error || !transaction || transaction.status !== "success" || transaction.refunded_at) {
      throw new Error("This purchase could not be verified.");
    }

    const product = transaction.products as unknown as { name: string } | null;
    return {
      transactionId: transaction.id,
      productName: product?.name ?? "Your purchase",
      amountPaidCents: transaction.amount_paid_cents,
    };
  });
