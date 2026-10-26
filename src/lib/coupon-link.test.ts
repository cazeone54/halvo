import { describe, expect, it } from "vitest";
import { couponLink, readCouponParam } from "./coupon-link";

describe("couponLink", () => {
  it("builds a product link with the code applied", () => {
    expect(couponLink("https://halvo.io", "yoga-plan", "welcome10")).toBe("https://halvo.io/p/yoga-plan?coupon=WELCOME10");
  });

  it("falls back to the plain product link without a usable code", () => {
    expect(couponLink("https://halvo.io/", "yoga-plan", null)).toBe("https://halvo.io/p/yoga-plan");
    expect(couponLink("https://halvo.io", "yoga-plan", "no spaces allowed")).toBe("https://halvo.io/p/yoga-plan");
  });
});

describe("readCouponParam", () => {
  it("reads and upper-cases a valid code", () => {
    expect(readCouponParam({ coupon: "welcome10" })).toBe("WELCOME10");
    expect(readCouponParam({ coupon: " SAVE_20 " })).toBe("SAVE_20");
  });

  it("ignores anything that isn't a plausible code", () => {
    expect(readCouponParam({})).toBeUndefined();
    expect(readCouponParam({ coupon: "x" })).toBeUndefined();
    expect(readCouponParam({ coupon: "<script>" })).toBeUndefined();
    expect(readCouponParam({ coupon: 123 })).toBeUndefined();
    expect(readCouponParam({ coupon: "A".repeat(40) })).toBeUndefined();
  });
});
