// Phase 1 has no plan tiers yet (that's Phase 2 — a single `subscriptions`-driven
// tier model, deliberately not the two divergent models Kitsly ended up with).
// Every seller pays a flat platform fee for now.
export const PLATFORM_FEE_PCT = 0.05;

// Stripe requires a minimum charge amount (roughly $0.50 for USD).
export const MIN_CHARGE_CENTS = 50;

export function calcPlatformFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * PLATFORM_FEE_PCT);
}
