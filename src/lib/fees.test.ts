import { describe, it, expect } from "vitest";
import { calcPlatformFeeCents, PLATFORM_FEE_PCT, MIN_CHARGE_CENTS } from "@/lib/fees";

describe("calcPlatformFeeCents", () => {
  it("computes the flat platform fee percentage", () => {
    expect(calcPlatformFeeCents(10_00)).toBe(Math.round(10_00 * PLATFORM_FEE_PCT));
  });

  it("returns 0 for zero or negative amounts", () => {
    expect(calcPlatformFeeCents(0)).toBe(0);
    expect(calcPlatformFeeCents(-100)).toBe(0);
  });

  it("rounds to the nearest cent", () => {
    // 333 * 0.05 = 16.65 -> rounds to 17
    expect(calcPlatformFeeCents(333)).toBe(17);
  });
});

describe("MIN_CHARGE_CENTS", () => {
  it("matches Stripe's practical USD minimum", () => {
    expect(MIN_CHARGE_CENTS).toBe(50);
  });
});
