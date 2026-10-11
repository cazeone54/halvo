// Pure money-logic, kept separate from checkout.functions.ts so it's testable
// without mocking Stripe/Supabase modules.
import { MIN_CHARGE_CENTS } from "@/lib/fees";
import { calcPlatformFeeCents, type PlanTier } from "@/lib/plans";
import { applyCouponDiscount, type CouponDiscount } from "@/lib/coupon-math";

export type ProductPricing = {
  price_cents: number;
  pay_what_you_want: boolean;
};

// Server-side charge amount — never trusts a client-sent amount for
// fixed-price products; only lets pay-what-you-want bump the price up.
export function computeChargeAmountCents(product: ProductPricing, requestedAmountCents?: number): number {
  if (!product.pay_what_you_want) return product.price_cents;
  return Math.max(product.price_cents, requestedAmountCents ?? product.price_cents);
}

export function isAboveMinimumCharge(amountCents: number): boolean {
  return amountCents >= MIN_CHARGE_CENTS;
}

// A free product (lead magnet) is delivered without any payment at all — no
// Stripe charge, and crucially no Connect onboarding required of the seller,
// so someone can give a file away in exchange for an email before they've done
// any KYC. Pay-what-you-want is never free: it has a floor and takes payment.
export function isFreeProduct(product: ProductPricing): boolean {
  return !product.pay_what_you_want && product.price_cents === 0;
}

// The minimum amount a completed payment must have reached to be accepted
// as a valid purchase for this product.
export function enforcedMinCents(product: ProductPricing): number {
  return product.pay_what_you_want ? MIN_CHARGE_CENTS : product.price_cents;
}

// The actual fix vs. Kitsly's coupon verification: Kitsly only re-checked a
// coupon-discounted purchase against the flat $0.50 floor, not the real
// expected discounted price — so a buyer could apply a valid coupon client-
// side, then quietly pay less than the coupon's actual discount allowed
// (still above $0.50) and it would be accepted. Here the exact discounted
// minimum is recomputed server-side and enforced.
export function computeRequiredMinCents(product: ProductPricing, coupon: CouponDiscount | null): number {
  const base = enforcedMinCents(product);
  if (!coupon) return base;
  return applyCouponDiscount(base, coupon);
}

// Final amount to charge: the base (already floored for pay-what-you-want and
// already discounted by any coupon) plus an order bump if one was taken. The
// bump is deliberately added *after* the coupon — a bump is already a discounted
// add-on, so stacking a coupon on top of it would erode the seller's margin
// twice on the same checkout.
export function composeChargeAmount(input: { baseAfterCouponCents: number; bumpPriceCents?: number }): number {
  const base = Math.max(0, input.baseAfterCouponCents);
  const bump = Math.max(0, input.bumpPriceCents ?? 0);
  return base + bump;
}

export type DestinationChargeParams = {
  amount: number;
  application_fee_amount: number;
  transfer_data: { destination: string };
  on_behalf_of: string;
};

// The actual Kitsly fix: every purchase charge routes through Stripe Connect
// as a destination charge, so the seller is actually paid and the platform
// actually collects its cut — instead of a plain platform-account charge
// with no Connect routing at all.
//
// WHO PAYS WHAT: the seller's only cost is `application_fee_amount` (the
// platform fee). On a destination charge Stripe debits its own processing fee
// from the PLATFORM's balance, not the connected account — so the platform fee
// has to clear it on every sale (enforced by a test in plans.test.ts). The
// platform also eats the $15 dispute fee, which is never returned. Since
// 2026-10-11 every tier pays the same rate; see SINGLE_TIER_PRICING in
// plans.ts. (An older comment here claimed Creator/Pro pay no platform fee —
// that described the bug that caused losses on paid-tier sales, not current
// behaviour.)
// `commissionCents` is an affiliate payout withheld on top of the platform fee.
// It has to be held back *here*, at charge time, so it comes out of the sale —
// i.e. the seller funds their affiliate, exactly as in any affiliate program.
// Previously the commission was only written to a ledger after the fact while
// the seller still received the full transfer, so the platform paid it out of a
// margin far smaller than the commission itself, losing money on every
// referred sale.
export function buildDestinationChargeParams(
  amountCents: number,
  connectedAccountId: string,
  sellerTier: PlanTier,
  commissionCents = 0,
): DestinationChargeParams {
  const safeAmount = Math.max(0, amountCents);
  const platformFee = calcPlatformFeeCents(sellerTier, safeAmount);
  const withheld = platformFee + Math.max(0, commissionCents);
  return {
    amount: amountCents,
    // Stripe requires the application fee to not exceed the charge itself.
    application_fee_amount: Math.min(withheld, safeAmount),
    transfer_data: { destination: connectedAccountId },
    // The seller is the business of record: their name is on the buyer's
    // statement and the sale is theirs (they're responsible for its taxes).
    // Halvo's fee and dispute handling are unchanged.
    on_behalf_of: connectedAccountId,
  };
}
