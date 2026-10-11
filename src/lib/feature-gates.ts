import { SINGLE_TIER_PRICING, type PlanTier } from "@/lib/plans";

// Discounts and affiliates used to be paid-tier perks. With single-tier
// pricing there is nothing to upgrade to, so they're open to every seller —
// gating them would lock everyone out of features the site advertises.
export function isPaidFeatureLocked(tier: PlanTier): boolean {
  return !SINGLE_TIER_PRICING && tier === "free";
}
