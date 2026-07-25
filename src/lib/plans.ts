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

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    productsMax: 3,
    filesPerProduct: 1,
    maxFileMb: 100,
    totalStorageMb: 500,
    monthlyBandwidthGb: 5,
    platformFeePct: 0.08,
    platformFeeFixedCents: 35,
    aiGenerationsPerMonth: 10,
  },
  creator: {
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 10,
    maxFileMb: 2048,
    totalStorageMb: 20480,
    monthlyBandwidthGb: 150,
    platformFeePct: 0.05,
    platformFeeFixedCents: 35,
    aiGenerationsPerMonth: 100,
  },
  pro: {
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 50,
    maxFileMb: 10240,
    totalStorageMb: 204800,
    monthlyBandwidthGb: 1024,
    platformFeePct: 0.04,
    platformFeeFixedCents: 35,
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
