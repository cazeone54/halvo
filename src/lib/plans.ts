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
  platformFeePct: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    productsMax: 3,
    filesPerProduct: 1,
    maxFileMb: 100,
    totalStorageMb: 500,
    platformFeePct: 0.05,
  },
  creator: {
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 10,
    maxFileMb: 2048,
    totalStorageMb: 20480,
    platformFeePct: 0,
  },
  pro: {
    productsMax: Number.POSITIVE_INFINITY,
    filesPerProduct: 50,
    maxFileMb: 10240,
    totalStorageMb: 204800,
    platformFeePct: 0,
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
  if (priceId === STRIPE_PRICE_IDS.pro) return "pro";
  if (priceId === STRIPE_PRICE_IDS.creator) return "creator";
  return "free";
}

export function calcPlatformFeeCents(tier: PlanTier, amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * PLAN_LIMITS[tier].platformFeePct);
}
