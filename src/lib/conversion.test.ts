import { describe, it, expect } from "vitest";
import { conversionRatePct, formatConversionRate } from "@/lib/conversion";

describe("conversionRatePct", () => {
  it("computes a normal rate", () => {
    expect(conversionRatePct(5, 100)).toBe(5);
    expect(conversionRatePct(1, 8)).toBeCloseTo(12.5, 5);
  });

  it("returns null when there are no views (unknown, not zero)", () => {
    expect(conversionRatePct(0, 0)).toBeNull();
    expect(conversionRatePct(3, 0)).toBeNull();
  });

  it("caps at 100% when sales outpace recorded views", () => {
    expect(conversionRatePct(9, 4)).toBe(100);
  });

  it("guards against non-finite inputs", () => {
    expect(conversionRatePct(NaN, 10)).toBeNull();
    expect(conversionRatePct(1, Infinity)).toBeNull();
  });
});

describe("formatConversionRate", () => {
  it("shows a dash when there's no view data", () => {
    expect(formatConversionRate(0, 0)).toBe("—");
    expect(formatConversionRate(2, 0)).toBe("—");
  });

  it("uses one decimal below 10% and none at or above", () => {
    expect(formatConversionRate(24, 1000)).toBe("2.4%");
    expect(formatConversionRate(23, 100)).toBe("23%");
  });

  it("shows 100% when capped", () => {
    expect(formatConversionRate(5, 2)).toBe("100%");
  });
});
