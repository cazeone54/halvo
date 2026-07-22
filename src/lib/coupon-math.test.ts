import { describe, it, expect } from "vitest";
import { applyCouponDiscount } from "@/lib/coupon-math";
import { MIN_CHARGE_CENTS } from "@/lib/fees";

describe("applyCouponDiscount", () => {
  it("applies a percent-off discount", () => {
    expect(applyCouponDiscount(1000, { percent_off: 20, amount_off_cents: null })).toBe(800);
  });

  it("applies an amount-off discount", () => {
    expect(applyCouponDiscount(1000, { percent_off: null, amount_off_cents: 300 })).toBe(700);
  });

  it("floors at the Stripe minimum — a coupon can never zero out a charge", () => {
    expect(applyCouponDiscount(100, { percent_off: 100, amount_off_cents: null })).toBe(MIN_CHARGE_CENTS);
    expect(applyCouponDiscount(100, { percent_off: null, amount_off_cents: 10_000 })).toBe(MIN_CHARGE_CENTS);
  });

  it("rounds percent-off to the nearest cent", () => {
    // 333 * (1 - 0.1) = 299.7 -> rounds to 300
    expect(applyCouponDiscount(333, { percent_off: 10, amount_off_cents: null })).toBe(300);
  });
});
