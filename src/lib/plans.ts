// Single source of truth for plan tiers and limits. Both the UI and server
// enforcement read from here so they can never drift apart. There is
// deliberately only one tier model in this whole app (see
// supabase/migrations/0002_subscriptions.sql) — Kitsly had two that could
// disagree with each other.

export type PlanTier = "free" | "creator" | "pro";

export type PlanLimits = {
  productsMax: number; // Number.POSITIVE_INFINITY = unlimited
  filesPerProduct: number;
  maxFileMb: number;
  totalStorageMb: number;
  monthlyBandwidthGb: number; // soft cap — surfaced + nudges upgrade, never blocks a paid download
  // Platform fee is a percentage PLUS a fixed amount. The fixed part exists
  // because Stripe's cost has a flat 30c component that no percentage can cover
  // on small sales (5% of a $5 sale is 25c against a ~45c cost). The percentage
  // must also stay above Stripe's 2.9% or high-value sales lose money too.
  // The fixed part sits a few cents ABOVE Stripe's 30c to price in the expected
  // cost of chargebacks: Stripe's $15 dispute fee is billed to the platform and
  // never returned, and it can't be recovered from the disputed sale because a
  // transfer reversal can't exceed the original transfer.
  platformFeePct: number;
  platformFeeFixedCents: number;
  aiGenerationsPerMonth: number;
};

// ─── Single-tier pricing ────────────────────────────────────────────────────
// The paid tiers are built and tested but deliberately NOT sold. Everyone pays
// one rate: UNIVERSAL_FEE. Why (decided 2026-10-11, from the modelling):
//
//  1. They help nobody we're recruiting. Creator only beats a flat 7% above
//     ~$500/mo of sales and Pro above ~$800/mo. Every target seller is far
//     below that, so a tier is strictly worse for them AND earns the platform
//     less at volume (a seller picks the cheapest option by definition, so at
//     100 sales/mo tiers cost the platform $123 against flat 7%).
//  2. 7% is the only rate with FX headroom. Break-even Stripe cost is 7.10%
//     for this rate but only 5.10%/4.10% for the old Creator/Pro rates — and
//     STRIPE_PERCENT_FEE below is US-domestic pricing, while this account is
//     Bulgarian charging USD. International cards plus currency conversion can
//     plausibly exceed 4.1%, which made Pro loss-making on every sale.
//  3. It keeps subscription machinery (dunning, proration, cancellation) out
//     of the launch path.
//
// TO RE-ENABLE TIERS: set SINGLE_TIER_PRICING to false and restore the
// commented per-tier rates below. Nothing else in the app needs to change —
// pricing UI reads ACTIVE_TIERS, fees read PLAN_LIMITS.
export const SINGLE_TIER_PRICING = true;

// ─── Direct charges ─────────────────────────────────────────────────────────
// With DESTINATION charges the platform pays Stripe's processing fee and the
// $15 dispute fee, so the platform fee has to clear both — hence 7% + 35¢.
//
// With DIRECT charges the PaymentIntent is created on the seller's connected
// account: the money is never in the platform's balance, Stripe's fee and any
// dispute are debited from the seller, and the platform only takes an
// application fee. That fee is then pure margin with no variable cost to
// outrun, so it can be lower AND the fixed component disappears — the 35¢
// existed only to cover Stripe's 30¢ and chargeback risk, both of which have
// moved.
//
// Toggled by VITE_STRIPE_DIRECT_CHARGES so the pricing UI and the server agree.
// Leave it off until the test-mode checklist in
// docs/on-behalf-of-migration-plan.md passes.
export const DIRECT_CHARGES = import.meta.env.VITE_STRIPE_DIRECT_CHARGES === "true";

export const UNIVERSAL_FEE_PCT = DIRECT_CHARGES ? 0.05 : 0.07;
export const UNIVERSAL_FEE_FIXED_CENTS = DIRECT_CHARGES ? 0 : 35;

// Which tiers the pricing UI offers. Tier rows already in the database still
// resolve and keep their (more generous) limits — they just pay the same rate.
export const ACTIVE_TIERS: PlanTier[] = SINGLE_TIER_PRICING
  ? ["free"]
  : ["free", "creator", "pro"];

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    // Raised from 3 / 1 / 100MB / 500MB / 5GB / 10 when tiers were retired —
    // with nothing to upgrade to, the old free limits were just a wall.
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 10,
    maxFileMb: 2048,
    totalStorageMb: 20480,
    monthlyBandwidthGb: 150,
    platformFeePct: UNIVERSAL_FEE_PCT, // was 0.07
    platformFeeFixedCents: UNIVERSAL_FEE_FIXED_CENTS,
    aiGenerationsPerMonth: 100,
  },
  creator: {
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 10,
    maxFileMb: 2048,
    totalStorageMb: 20480,
    monthlyBandwidthGb: 150,
    platformFeePct: UNIVERSAL_FEE_PCT, // was 0.05
    platformFeeFixedCents: UNIVERSAL_FEE_FIXED_CENTS,
    aiGenerationsPerMonth: 100,
  },
  pro: {
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 50,
    maxFileMb: 10240,
    totalStorageMb: 204800,
    monthlyBandwidthGb: 1024,
    platformFeePct: UNIVERSAL_FEE_PCT, // was 0.04
    platformFeeFixedCents: UNIVERSAL_FEE_FIXED_CENTS,
    aiGenerationsPerMonth: 300,
  },
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
};

export const PLAN_PRICE_USD: Record<Exclude<PlanTier, "free">, number> = {
  creator: 10,
  pro: 24,
};

// Annual pricing = 2 months free (10x the monthly price). Cheaper for the
// seller, and it gives the platform a year of cash up front plus far better
// retention.
export const PLAN_PRICE_ANNUAL_USD: Record<Exclude<PlanTier, "free">, number> = {
  creator: 100,
  pro: 240,
};

// Fill these in from the annual Stripe Prices (create them in the Stripe
// dashboard alongside the monthly ones). While they're empty, annual billing is
// simply not offered anywhere — nothing misleading is shown.
export const STRIPE_PRICE_IDS_ANNUAL: Record<Exclude<PlanTier, "free">, string> = {
  creator: "",
  pro: "",
};

export function annualBillingConfigured(): boolean {
  return STRIPE_PRICE_IDS_ANNUAL.creator !== "" && STRIPE_PRICE_IDS_ANNUAL.pro !== "";
}

// Real Stripe Price IDs for this Halvo project (test mode). Not secret —
// price IDs are safe to reference client-side, same as Kitsly's own pattern.
export const STRIPE_PRICE_IDS: Record<Exclude<PlanTier, "free">, string> = {
  creator: "price_1Tw60RGbMvgTEXSSwnMojPRx",
  pro: "price_1Tw60RGbMvgTEXSSoCyK6ndb",
};

// Exact-match only — deliberately not Kitsly's "unrecognized price ID falls
// back to Creator" behavior, which silently over-granted access on any
// Stripe misconfiguration. An unrecognized price here just means Free.
export function tierFromPriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return "free";
  // Both the monthly and the annual price for a tier resolve to that tier. The
  // annual guards are so an empty (unconfigured) annual id can't match anything.
  if (priceId === STRIPE_PRICE_IDS.pro || (STRIPE_PRICE_IDS_ANNUAL.pro && priceId === STRIPE_PRICE_IDS_ANNUAL.pro)) {
    return "pro";
  }
  if (
    priceId === STRIPE_PRICE_IDS.creator ||
    (STRIPE_PRICE_IDS_ANNUAL.creator && priceId === STRIPE_PRICE_IDS_ANNUAL.creator)
  ) {
    return "creator";
  }
  return "free";
}

// Percentage + fixed. Every tier pays something, because every sale costs the
// platform Stripe's ~2.9% + 30c on a destination charge. Higher tiers pay a
// lower rate (that's the upgrade incentive), never zero.
export function calcPlatformFeeCents(tier: PlanTier, amountCents: number): number {
  if (amountCents <= 0) return 0;
  const limits = PLAN_LIMITS[tier];
  const fee = Math.round(amountCents * limits.platformFeePct) + limits.platformFeeFixedCents;
  // Safety: never take more than the sale itself on a near-minimum charge.
  return Math.min(fee, amountCents);
}
