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

// Stripe's chargeback fee. It is billed to the PLATFORM on a destination charge
// and is NOT returned even when the dispute is won. A transfer reversal can
// never exceed the original transfer, so this cost can't be clawed back from
// the disputed sale itself — instead a slice of it is priced into every sale's
// fixed fee component (see platformFeeFixedCents in plans.ts). Per-seller
// recoupment becomes worthwhile only at volume.
export const DISPUTE_FEE_CENTS = 1500;

export function estimateStripeFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * STRIPE_PERCENT_FEE) + STRIPE_FIXED_FEE_CENTS;
}
