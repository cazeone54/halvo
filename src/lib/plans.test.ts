import { describe, it, expect } from "vitest";
import {
  tierFromPriceId,
  calcPlatformFeeCents,
  STRIPE_PRICE_IDS,
  PLAN_LIMITS,
  SINGLE_TIER_PRICING,
  ACTIVE_TIERS,
  type PlanTier,
} from "@/lib/plans";
import { MIN_CHARGE_CENTS, estimateStripeFeeCents, STRIPE_FIXED_FEE_CENTS } from "@/lib/fees";

describe("tierFromPriceId", () => {
  it("maps known price IDs to their exact tier", () => {
    expect(tierFromPriceId(STRIPE_PRICE_IDS.creator)).toBe("creator");
    expect(tierFromPriceId(STRIPE_PRICE_IDS.pro)).toBe("pro");
  });

  it("defaults unrecognized or missing price IDs to free — never over-grants", () => {
    // The actual Kitsly bug this fixes: an unrecognized/misconfigured price
    // ID there silently fell back to Creator ("safer to over-grant"). Here
    // it must fail closed to Free instead.
    expect(tierFromPriceId("price_totally_unknown")).toBe("free");
    expect(tierFromPriceId(null)).toBe("free");
    expect(tierFromPriceId(undefined)).toBe("free");
  });

  it("does not substring-match — a price id merely containing 'pro' must not resolve to pro", () => {
    expect(tierFromPriceId("price_procrastination_plan")).toBe("free");
  });
});

describe("calcPlatformFeeCents", () => {
  it("charges a percentage plus the fixed component", () => {
    const limits = PLAN_LIMITS.free;
    expect(calcPlatformFeeCents("free", 1000)).toBe(
      Math.round(1000 * limits.platformFeePct) + limits.platformFeeFixedCents,
    );
  });

  it("charges every tier something — no tier is free to transact on", () => {
    expect(calcPlatformFeeCents("creator", 1000)).toBeGreaterThan(0);
    expect(calcPlatformFeeCents("pro", 1000)).toBeGreaterThan(0);
  });

  // Replaced "higher tiers are cheaper" when tiers were retired. If
  // SINGLE_TIER_PRICING is ever turned back off, restore that assertion.
  it("charges one rate while single-tier pricing is on", () => {
    expect(SINGLE_TIER_PRICING).toBe(true);
    expect(ACTIVE_TIERS).toEqual(["free"]);
    expect(calcPlatformFeeCents("creator", 5000)).toBe(calcPlatformFeeCents("free", 5000));
    expect(calcPlatformFeeCents("pro", 5000)).toBe(calcPlatformFeeCents("free", 5000));
  });

  // The invariant that actually protects the business: the fee has to clear
  // Stripe's cost on a destination charge, or the platform pays to process
  // someone else's sale. Checked across the whole realistic price range.
  it("never charges less than Stripe costs, at any price, on any tier", () => {
    for (const tier of ["free", "creator", "pro"] as PlanTier[]) {
      for (const amount of [MIN_CHARGE_CENTS, 100, 500, 1500, 4900, 9900, 49900, 100000]) {
        expect(calcPlatformFeeCents(tier, amount)).toBeGreaterThan(estimateStripeFeeCents(amount));
      }
    }
  });

  it("returns 0 for zero or negative amounts regardless of tier", () => {
    expect(calcPlatformFeeCents("free", 0)).toBe(0);
    expect(calcPlatformFeeCents("free", -500)).toBe(0);
  });

  it("never takes more than the sale itself on a minimum-size charge", () => {
    expect(calcPlatformFeeCents("free", MIN_CHARGE_CENTS)).toBeLessThanOrEqual(MIN_CHARGE_CENTS);
  });

  it("prices in expected chargeback cost above Stripe's own fixed fee", () => {
    // Stripe's $15 dispute fee is billed to the platform and isn't returned
    // even when the dispute is won, and it can't be clawed back from the
    // disputed sale (a transfer reversal can't exceed the original transfer).
    // So a few cents of it is priced into every sale instead.
    const tiers: PlanTier[] = ["free", "creator", "pro"];
    for (const tier of tiers) {
      expect(PLAN_LIMITS[tier].platformFeeFixedCents).toBeGreaterThan(STRIPE_FIXED_FEE_CENTS);
    }
  });

  it("always clears Stripe's processing cost — the platform must never lose money on a sale", () => {
    // The actual bug this locks out: paid tiers charged 0% while the platform
    // still paid Stripe ~2.9% + 30c on every destination charge, so each
    // paid-tier sale was a loss that grew with the seller's volume. The flat
    // 30c also meant even Free's old 5% lost money on anything under ~$6.
    const tiers: PlanTier[] = ["free", "creator", "pro"];
    const amounts = [MIN_CHARGE_CENTS, 100, 500, 1900, 4900, 20_000];
    for (const tier of tiers) {
      for (const amount of amounts) {
        expect(calcPlatformFeeCents(tier, amount)).toBeGreaterThanOrEqual(estimateStripeFeeCents(amount));
      }
    }
  });
});
