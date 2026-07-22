import { describe, it, expect } from "vitest";
import { tierFromPriceId, calcPlatformFeeCents, STRIPE_PRICE_IDS, PLAN_LIMITS } from "@/lib/plans";

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
  it("charges the free-tier platform fee", () => {
    expect(calcPlatformFeeCents("free", 1000)).toBe(Math.round(1000 * PLAN_LIMITS.free.platformFeePct));
  });

  it("charges zero platform fee for paid tiers", () => {
    expect(calcPlatformFeeCents("creator", 1000)).toBe(0);
    expect(calcPlatformFeeCents("pro", 1000)).toBe(0);
  });

  it("returns 0 for zero or negative amounts regardless of tier", () => {
    expect(calcPlatformFeeCents("free", 0)).toBe(0);
    expect(calcPlatformFeeCents("free", -500)).toBe(0);
  });
});
