// Stripe requires a minimum charge amount (roughly $0.50 for USD).
// Platform-fee rates now live in plans.ts, keyed by tier — see
// calcPlatformFeeCents there.
export const MIN_CHARGE_CENTS = 50;

// Stripe's standard US card processing cost. On a Connect *destination* charge
// this is billed to the PLATFORM, not the connected account — so the platform
// fee has to clear it on every single sale or the transaction loses money. That
// was the actual bug: paid tiers charged 0%, so every paid-tier sale cost the
// platform ~2.9% + 30c, and the loss grew with the seller's success.
export const STRIPE_PERCENT_FEE = 0.029;
export const STRIPE_FIXED_FEE_CENTS = 30;

export function estimateStripeFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * STRIPE_PERCENT_FEE) + STRIPE_FIXED_FEE_CENTS;
}
