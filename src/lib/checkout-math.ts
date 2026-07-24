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

export type DestinationChargeParams = {
  amount: number;
  application_fee_amount: number;
  transfer_data: { destination: string };
};

// The actual Kitsly fix: every purchase charge routes through Stripe Connect
// as a destination charge, so the seller is actually paid and the platform
// actually collects its cut — instead of a plain platform-account charge
// with no Connect routing at all. The fee percentage depends on the
// *seller's* plan tier (Free pays a platform fee; Creator/Pro don't).
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
  };
}
