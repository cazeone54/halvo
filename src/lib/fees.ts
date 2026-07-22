// Stripe requires a minimum charge amount (roughly $0.50 for USD).
// Platform-fee percentage now lives in plans.ts, keyed by tier — see
// calcPlatformFeeCents there.
export const MIN_CHARGE_CENTS = 50;
