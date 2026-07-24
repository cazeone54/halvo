import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { resolveOptionalUserId } from "@/lib/optional-auth.server";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { findValidCoupon } from "@/lib/coupons.functions";
import { applyCouponDiscount } from "@/lib/coupon-math";
import { resolveReferralCode } from "@/lib/referrals.functions";
import { calcCommissionCents } from "@/lib/commission-math";
import { computeTransactionBackfill } from "@/lib/transaction-race";
import { sendPurchaseConfirmationEmail } from "@/lib/email.server";
import {
  computeChargeAmountCents,
  isAboveMinimumCharge,
  computeRequiredMinCents,
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
        couponCode: z.string().trim().min(1).optional(),
        referralCode: z.string().trim().min(1).optional(),
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

    let chargeAmountCents = computeChargeAmountCents(product, data.amountCents);

    if (data.couponCode) {
      const coupon = await findValidCoupon(supabaseAdmin, data.couponCode, product.id);
      if (!coupon) throw new Error("Invalid or expired coupon code.");
      chargeAmountCents = applyCouponDiscount(chargeAmountCents, coupon);
    }

    if (!isAboveMinimumCharge(chargeAmountCents)) {
      throw new Error("The charge amount is below the minimum allowed.");
    }

    const sellerTier = await resolveUserTier(supabaseAdmin, product.owner_id);

    // Resolve the affiliate here, at charge time, so the commission can be
    // withheld from the sale rather than paid out of the platform's margin.
    // The code is stamped into metadata and that becomes the source of truth
    // when the commission is recorded — we only ever pay a commission we
    // actually held money back for.
    let commissionCents = 0;
    let referralCodeForMetadata: string | null = null;
    if (data.referralCode) {
      const referral = await resolveReferralCode(supabaseAdmin, data.referralCode, product.id);
      if (referral && referral.userId !== product.owner_id) {
        commissionCents = calcCommissionCents(chargeAmountCents);
        referralCodeForMetadata = data.referralCode;
      }
    }

    try {
      const intent = await stripe.paymentIntents.create({
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          productId: product.id,
          product_name: product.name,
          ...(data.couponCode ? { coupon_code: data.couponCode.toUpperCase() } : {}),
          ...(referralCodeForMetadata ? { referral_code: referralCodeForMetadata } : {}),
        },
        ...buildDestinationChargeParams(
          chargeAmountCents,
          sellerProfile.stripe_connect_id,
          sellerTier,
          commissionCents,
        ),
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
        referralCode: z.string().trim().min(1).optional(),
        acknowledgedTerms: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripeClient();

    const intent = await stripe.paymentIntents.retrieve(data.paymentIntentId);
    if (intent.status !== "succeeded") {
      throw new Error("Payment has not succeeded yet.");
    }
    if (intent.metadata.productId !== data.productId) {
      throw new Error("Payment does not match this product.");
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cents, pay_what_you_want, owner_id")
      .eq("id", data.productId)
      .single();
    if (productError || !product) throw new Error("Product not found");

    const couponCode = intent.metadata.coupon_code as string | undefined;
    let coupon = null;
    if (couponCode) {
      coupon = await findValidCoupon(supabaseAdmin, couponCode, product.id);
    }

    if (intent.amount_received < computeRequiredMinCents(product, coupon)) {
      throw new Error("Payment amount is below the required minimum for this product.");
    }

    const buyerId = await resolveOptionalUserId();
    // The buyer ticked the final-sale acknowledgment before paying. Recorded
    // as a timestamp so it doubles as dispute evidence (see 0006 migration).
    const termsAckedAt = data.acknowledgedTerms ? new Date().toISOString() : null;

    // The webhook's payment_intent.succeeded reconciliation fallback
    // (Phase 1) races this exact insert — both this call and the webhook see
    // "no existing row" and both try to insert. Rather than one side just
    // silently no-op'ing (which used to skip coupon-redemption/commission
    // bookkeeping entirely whenever the webhook won), both branches below
    // converge on the same transactionId and both still run the
    // coupon/commission enrichment against it.
    let transactionId: string;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        product_id: product.id,
        seller_id: product.owner_id,
        buyer_id: buyerId,
        buyer_email: data.buyerEmail.toLowerCase(),
        status: "success",
        amount_paid_cents: intent.amount_received,
        stripe_payment_intent_id: intent.id,
        coupon_code: couponCode ?? null,
        terms_acked_at: termsAckedAt,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code !== "23505") throw new Error(insertError.message); // not unique_violation
      const { data: existing } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, coupon_code, terms_acked_at")
        .eq("stripe_payment_intent_id", intent.id)
        .single();
      if (!existing) throw new Error("Could not record purchase");
      transactionId = existing.id;

      // Backfill fields the winning writer (the webhook fallback) doesn't
      // know how to set itself.
      const backfill = computeTransactionBackfill(existing, {
        buyerId,
        couponCode: couponCode ?? null,
        termsAckedAt,
      });
      if (Object.keys(backfill).length > 0) {
        await supabaseAdmin.from("transactions").update(backfill).eq("id", transactionId);
      }
    } else {
      if (!inserted) throw new Error("Could not record purchase");
      transactionId = inserted.id;
      // Only the writer that actually created the row sends the email —
      // same "whoever inserted fresh" rule as coupon redemption counting,
      // so a race with the webhook fallback can't send a duplicate email.
      await sendPurchaseConfirmationEmail({
        buyerEmail: data.buyerEmail,
        productName: product.name,
        transactionId,
      });
    }

    // coupon_redemptions has a unique constraint on transaction_id, so this
    // is naturally idempotent regardless of which side won the row-insert
    // race — the same trick used for commissions below. A mutable counter
    // column can't give this guarantee (it either double-counts or, as
    // observed in testing, never increments at all depending on which
    // writer won).
    if (coupon) {
      const { error: redemptionError } = await supabaseAdmin
        .from("coupon_redemptions")
        .insert({ coupon_id: coupon.id, transaction_id: transactionId });
      if (redemptionError && redemptionError.code !== "23505") throw new Error(redemptionError.message);
    }

    // Commissions have a unique constraint on transaction_id, so this is
    // naturally idempotent regardless of which side won the row-insert race.
    // The referral comes from the PaymentIntent metadata, not the client —
    // that's the code we actually withheld the commission for at charge time,
    // so a client can't cause a payout the sale didn't fund (same discipline
    // as coupon_code above).
    const referralCode = (intent.metadata?.referral_code as string | undefined) ?? undefined;
    if (referralCode) {
      const referral = await resolveReferralCode(supabaseAdmin, referralCode, product.id);
      if (referral && referral.userId !== product.owner_id) {
        const { error: commissionError } = await supabaseAdmin.from("commissions").insert({
          referral_code_id: referral.id,
          referrer_user_id: referral.userId,
          transaction_id: transactionId,
          kind: referral.kind,
          amount_cents: calcCommissionCents(intent.amount_received),
        });
        if (commissionError && commissionError.code !== "23505") throw new Error(commissionError.message);
      }
    }

    return { transactionId };
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
