// Pure money-logic, kept separate from checkout.functions.ts so it's testable
// without mocking Stripe/Supabase modules.
import { MIN_CHARGE_CENTS } from "@/lib/fees";
import { calcPlatformFeeCents, type PlanTier } from "@/lib/plans";

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

// The minimum amount a completed payment must have reached to be accepted
// as a valid purchase for this product.
export function enforcedMinCents(product: ProductPricing): number {
  return product.pay_what_you_want ? MIN_CHARGE_CENTS : product.price_cents;
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
export function buildDestinationChargeParams(
  amountCents: number,
  connectedAccountId: string,
  sellerTier: PlanTier,
): DestinationChargeParams {
  return {
    amount: amountCents,
    application_fee_amount: calcPlatformFeeCents(sellerTier, amountCents),
    transfer_data: { destination: connectedAccountId },
  };
}
