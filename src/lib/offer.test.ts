import { describe, expect, it } from "vitest";
import { activeSalePriceCents, effectivePricing, formatCountdown, stockRemaining, validateOffer } from "./offer";

const now = new Date("2026-10-10T12:00:00Z");
const later = "2026-10-12T12:00:00Z";
const earlier = "2026-10-09T12:00:00Z";
const base = { price_cents: 4900, pay_what_you_want: false };

describe("activeSalePriceCents", () => {
  it("applies a running sale", () => {
    expect(activeSalePriceCents({ ...base, sale_price_cents: 2900, sale_ends_at: later }, now)).toBe(2900);
  });
  it("ends exactly at the end time", () => {
    expect(activeSalePriceCents({ ...base, sale_price_cents: 2900, sale_ends_at: now.toISOString() }, now)).toBeNull();
    expect(activeSalePriceCents({ ...base, sale_price_cents: 2900, sale_ends_at: earlier }, now)).toBeNull();
  });
  it("ignores sales that would raise the price, go below the minimum, or apply to PWYW", () => {
    expect(activeSalePriceCents({ ...base, sale_price_cents: 5900, sale_ends_at: later }, now)).toBeNull();
    expect(activeSalePriceCents({ ...base, sale_price_cents: 10, sale_ends_at: later }, now)).toBeNull();
    expect(
      activeSalePriceCents({ ...base, pay_what_you_want: true, sale_price_cents: 2900, sale_ends_at: later }, now),
    ).toBeNull();
  });
  it("is null when columns are missing (migration not applied)", () => {
    expect(activeSalePriceCents(base, now)).toBeNull();
    expect(effectivePricing(base, now)).toEqual(base);
  });
});

describe("stockRemaining", () => {
  it("is null for unlimited and never negative", () => {
    expect(stockRemaining(null, 5)).toBeNull();
    expect(stockRemaining(50, 43)).toBe(7);
    expect(stockRemaining(50, 52)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("is coarse when far and precise when close", () => {
    expect(formatCountdown((2 * 86400 + 4 * 3600 + 59) * 1000)).toBe("2d 4h");
    expect(formatCountdown((3 * 3600 + 12 * 60) * 1000)).toBe("3h 12m");
    expect(formatCountdown((12 * 60 + 5) * 1000)).toBe("12m 05s");
    expect(formatCountdown(45_000)).toBe("45s");
    expect(formatCountdown(-1)).toBe("0s");
  });
});

describe("validateOffer", () => {
  const ok = {
    priceCents: 4900,
    payWhatYouWant: false,
    salePriceCents: null,
    saleEndsAt: null,
    stockLimit: null,
    soldCount: 0,
  };
  it("accepts no offer, a valid sale, and a valid stock limit", () => {
    expect(validateOffer(ok, now)).toBeNull();
    expect(validateOffer({ ...ok, salePriceCents: 2900, saleEndsAt: later }, now)).toBeNull();
    expect(validateOffer({ ...ok, stockLimit: 50, soldCount: 10 }, now)).toBeNull();
  });
  it("rejects incomplete, higher, past, too-long, PWYW and free sales", () => {
    expect(validateOffer({ ...ok, salePriceCents: 2900 }, now)).toMatch(/both/);
    expect(validateOffer({ ...ok, salePriceCents: 4900, saleEndsAt: later }, now)).toMatch(/lower/);
    expect(validateOffer({ ...ok, salePriceCents: 2900, saleEndsAt: earlier }, now)).toMatch(/future/);
    expect(validateOffer({ ...ok, salePriceCents: 2900, saleEndsAt: "2027-06-01T00:00:00Z" }, now)).toMatch(/90/);
    expect(validateOffer({ ...ok, payWhatYouWant: true, salePriceCents: 2900, saleEndsAt: later }, now)).toMatch(
      /Pay-what/,
    );
    expect(validateOffer({ ...ok, priceCents: 0, salePriceCents: 0, saleEndsAt: later }, now)).toMatch(/Free/);
  });
  it("rejects a stock limit below what's already sold", () => {
    expect(validateOffer({ ...ok, stockLimit: 5, soldCount: 8 }, now)).toMatch(/already sold 8/);
    expect(validateOffer({ ...ok, stockLimit: 0 }, now)).toMatch(/between/);
  });
});
