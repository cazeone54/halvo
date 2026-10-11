import { describe, expect, it } from "vitest";
import { listingPrice } from "./format";

const now = new Date("2026-10-11T12:00:00Z");
const base = { price_cents: 4900, pay_what_you_want: false };

describe("listingPrice", () => {
  it("formats fixed, free and pay-what-you-want prices", () => {
    expect(listingPrice(base, now)).toEqual({ label: "$49.00", regularLabel: null });
    expect(listingPrice({ ...base, price_cents: 0 }, now).label).toBe("Free");
    expect(listingPrice({ ...base, pay_what_you_want: true, price_cents: 0 }, now).label).toBe("From $0.00");
  });
  it("shows a running launch price with the regular price to strike through", () => {
    const p = { ...base, sale_price_cents: 2900, sale_ends_at: "2026-10-12T00:00:00Z" };
    expect(listingPrice(p, now)).toEqual({ label: "$29.00", regularLabel: "$49.00" });
    expect(listingPrice({ ...p, sale_ends_at: "2026-10-10T00:00:00Z" }, now)).toEqual({ label: "$49.00", regularLabel: null });
  });
  it("adds the membership interval", () => {
    expect(listingPrice({ ...base, price_cents: 900, billing_type: "membership", billing_interval: "month" }, now).label).toBe(
      "$9.00 / month",
    );
    expect(listingPrice({ ...base, billing_type: "membership", billing_interval: "year" }, now).label).toBe("$49.00 / year");
  });
});
