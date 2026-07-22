import { describe, it, expect } from "vitest";
import { calcCommissionCents, COMMISSION_PERCENT } from "@/lib/commission-math";

describe("calcCommissionCents", () => {
  it("computes the flat commission percentage", () => {
    expect(COMMISSION_PERCENT).toBe(10);
    expect(calcCommissionCents(1000)).toBe(100);
  });

  it("floors to the nearest cent rather than rounding", () => {
    // 999 * 10 / 100 = 99.9 -> floors to 99, never rounds up past what was
    // actually earned.
    expect(calcCommissionCents(999)).toBe(99);
  });

  it("returns 0 for zero or negative amounts", () => {
    expect(calcCommissionCents(0)).toBe(0);
    expect(calcCommissionCents(-500)).toBe(0);
  });
});
