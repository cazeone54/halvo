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
import { sendPurchaseConfirmationEmail, sendSaleNotificationEmail } from "@/lib/email.server";
import { recordSaleSource } from "@/lib/record-source.server";
import { countDeliverableFiles } from "@/lib/bundle.server";
import {
  computeChargeAmountCents,
  isAboveMinimumCharge,
  computeRequiredMinCents,
  buildDestinationChargeParams,
  isFreeProduct,
  composeChargeAmount,
} from "@/lib/checkout-math";

// Shown to a *buyer*, so it never leaks the seller's setup state (missing file,
// unfinished Stripe onboarding). They only need to know it can't be bought yet.
const UNAVAILABLE_MESSAGE = "This product isn't available for purchase yet.";

// Email the seller that they earned money. Best-effort throughout: a missing
// seller, an unreachable auth lookup or an email failure must never break the
// recording of a purchase the buyer has already paid for.
async function notifySellerOfSale(args: {
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
  sellerId: string | null;
  productName: string;
  amountCents: number;
}): Promise<void> {
  if (!args.sellerId) return;
  try {
    // Their very first sale gets different copy — this row is already written,
    // so a count of exactly 1 means this is it.
    const { count } = await args.supabaseAdmin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", args.sellerId)
      .eq("status", "success");

    const { data: sellerUser } = await args.supabaseAdmin.auth.admin.getUserById(args.sellerId);
    const sellerEmail = sellerUser?.user?.email;
    if (!sellerEmail) return;

    await sendSaleNotificationEmail({
      sellerEmail,
      productName: args.productName,
      amountCents: args.amountCents,
      isFirstSale: count === 1,
    });
  } catch (error) {
    console.error("Seller sale notification failed:", error);
  }
}

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
        // The buyer either took the order bump or didn't — a boolean. The price
        // is NEVER accepted from the client; it's resolved from product_bumps.
        bumpTaken: z.boolean().optional(),
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
    // Free products are delivered through claimFreeProduct — there's nothing to
    // charge, and Stripe rejects a zero-amount PaymentIntent outright.
    if (isFreeProduct(product)) {
      throw new Error("This product is free — no payment is needed.");
    }

    // Belt-and-braces against the worst possible outcome on a digital-goods
    // platform: a buyer paying for a product with nothing to download. Products
    // are only published once they have a file (see attachProductFile), but this
    // re-checks at the point money would actually move.
    // Counts bundled products too, so a bundle whose own file list is empty
    // still qualifies as long as it delivers something.
    if ((await countDeliverableFiles(supabaseAdmin, product.id)) === 0) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", product.owner_id)
      .single();
    if (!sellerProfile?.stripe_connect_id) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    const stripe = getStripeClient();
    let sellerAccount;
    try {
      sellerAccount = await stripe.accounts.retrieve(sellerProfile.stripe_connect_id);
    } catch {
      throw new Error(UNAVAILABLE_MESSAGE);
    }
    if (!sellerAccount.charges_enabled) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    let chargeAmountCents = computeChargeAmountCents(product, data.amountCents);

    if (data.couponCode) {
      const coupon = await findValidCoupon(supabaseAdmin, data.couponCode, product.id);
      if (!coupon) throw new Error("Invalid or expired coupon code.");
      chargeAmountCents = applyCouponDiscount(chargeAmountCents, coupon);
    }

    // Order bump: resolve its price server-side and add it after the coupon,
    // so a coupon can't also discount the (already-discounted) add-on. Stamped
    // into metadata as the source of truth, exactly like the coupon and
    // referral, so the recorded amount and the delivered files agree.
    let bumpProductId: string | null = null;
    let bumpPriceCents = 0;
    if (data.bumpTaken) {
      const { data: bump } = await supabaseAdmin
        .from("product_bumps")
        .select("bump_product_id, price_cents")
        .eq("product_id", product.id)
        .maybeSingle();
      if (bump) {
        bumpProductId = bump.bump_product_id;
        bumpPriceCents = Math.max(0, bump.price_cents);
        chargeAmountCents = composeChargeAmount({
          baseAfterCouponCents: chargeAmountCents,
          bumpPriceCents,
        });
      }
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
          ...(bumpProductId ? { bump_product_id: bumpProductId, bump_price_cents: String(bumpPriceCents) } : {}),
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
        referrer: z.string().max(500).optional(),
        utmSource: z.string().max(100).optional(),
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
      // Only the writer that actually created the row sends the emails —
      // same "whoever inserted fresh" rule as coupon redemption counting,
      // so a race with the webhook fallback can't send duplicates.
      await sendPurchaseConfirmationEmail({
        buyerEmail: data.buyerEmail,
        productName: product.name,
        transactionId,
      });
      await notifySellerOfSale({
        supabaseAdmin,
        sellerId: product.owner_id,
        productName: product.name,
        amountCents: intent.amount_received,
      });
    }

    // Order bump: read from the PaymentIntent metadata (the amount we actually
    // charged for), not the client. Unique on transaction_id, so idempotent
    // across the webhook race. This is also what makes the bump's files get
    // delivered — see downloads.functions.ts.
    const bumpProductIdMeta = intent.metadata?.bump_product_id as string | undefined;
    if (bumpProductIdMeta) {
      const bumpPrice = Number(intent.metadata?.bump_price_cents ?? "0");
      const { error: bumpError } = await supabaseAdmin.from("transaction_bumps").insert({
        transaction_id: transactionId,
        bump_product_id: bumpProductIdMeta,
        price_cents: Number.isFinite(bumpPrice) ? Math.max(0, Math.round(bumpPrice)) : 0,
      });
      if (bumpError && bumpError.code !== "23505") throw new Error(bumpError.message);
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

    // After everything that matters is committed — analytics must never be able
    // to affect whether a paid-for purchase is recorded.
    await recordSaleSource({
      transactionId,
      sellerId: product.owner_id,
      referrer: data.referrer,
      utmSource: data.utmSource,
    });

    return { transactionId };
  });

// Public — the success page's loader. Returns only non-PII fields.
export const getVerifiedTransaction = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .select("id, status, refunded_at, amount_paid_cents, product_id, seller_id, products(name, owner_id)")
      .eq("id", data.transactionId)
      .single();
    if (error || !transaction || transaction.status !== "success" || transaction.refunded_at) {
      throw new Error("This purchase could not be verified.");
    }

    const product = transaction.products as unknown as { name: string; owner_id: string | null } | null;

    // The seller's post-purchase thank-you note + optional next-step link,
    // shown on the download page. Best-effort: a missing seller or profile just
    // means no note, never a failed verification.
    let thankYouMessage: string | null = null;
    let thankYouRedirectUrl: string | null = null;
    const sellerId = transaction.seller_id ?? product?.owner_id ?? null;
    if (sellerId) {
      try {
        const { data: seller } = await supabaseAdmin
          .from("profiles")
          .select("thank_you_message, thank_you_redirect_url")
          .eq("id", sellerId)
          .single();
        thankYouMessage = seller?.thank_you_message ?? null;
        // Defence in depth: only ever hand the client an http(s) link, even if a
        // bad value somehow reached the column.
        const url = seller?.thank_you_redirect_url ?? null;
        thankYouRedirectUrl = url && /^https?:\/\//i.test(url) ? url : null;
      } catch {
        // no thank-you note available — the page renders without it.
      }
    }

    return {
      transactionId: transaction.id,
      productName: product?.name ?? "Your purchase",
      amountPaidCents: transaction.amount_paid_cents,
      thankYouMessage,
      thankYouRedirectUrl,
    };
  });
