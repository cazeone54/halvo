import { describe, it, expect } from "vitest";
import {
  addTo,
  asCurrency,
  currencyForCountry,
  currencyFromLanguages,
  currencyFromTimeZone,
  formatMoney,
  formatTotals,
  pricedIn,
} from "./currency";
import { listingPrice } from "./format";

describe("currencyForCountry", () => {
  it("gives Europe euros and everyone else dollars", () => {
    for (const c of ["BG", "DE", "FR", "IE", "GB", "CH", "NO", "ua"]) expect(currencyForCountry(c)).toBe("eur");
    for (const c of ["US", "CA", "AU", "BR", "IN", "JP"]) expect(currencyForCountry(c)).toBe("usd");
  });

  it("keeps euros when the country is unknown", () => {
    for (const c of [null, undefined, "", "XX", "T1"]) expect(currencyForCountry(c)).toBe("eur");
  });
});

describe("currency from the browser", () => {
  it("reads the first language that names a region", () => {
    expect(currencyFromLanguages("en-US,en;q=0.9")).toBe("usd");
    expect(currencyFromLanguages("en-GB,en;q=0.9")).toBe("eur");
    expect(currencyFromLanguages("bg,en-US;q=0.8")).toBe("usd");
    expect(currencyFromLanguages(["de-DE", "en"])).toBe("eur");
    expect(currencyFromLanguages("en")).toBeNull();
    expect(currencyFromLanguages(null)).toBeNull();
  });

  it("reads the time zone", () => {
    expect(currencyFromTimeZone("Europe/Sofia")).toBe("eur");
    expect(currencyFromTimeZone("Europe/London")).toBe("eur");
    expect(currencyFromTimeZone("Atlantic/Canary")).toBe("eur");
    expect(currencyFromTimeZone("America/New_York")).toBe("usd");
    expect(currencyFromTimeZone("Australia/Sydney")).toBe("usd");
    expect(currencyFromTimeZone("UTC")).toBeNull();
    expect(currencyFromTimeZone("Etc/GMT+2")).toBeNull();
  });
});

describe("pricedIn", () => {
  const product = { price_cents: 1900, sale_price_cents: 1500, price_usd_cents: null as number | null };

  it("leaves euro prices alone", () => {
    expect(pricedIn(product, "eur")).toBe(product);
  });

  it("uses the same number in dollars when the seller set none", () => {
    expect(pricedIn(product, "usd")).toMatchObject({ price_cents: 1900, sale_price_cents: 1500 });
  });

  it("uses the seller's dollar price, and scales a launch price with it", () => {
    const p = pricedIn({ ...product, price_usd_cents: 2200 }, "usd");
    expect(p.price_cents).toBe(2200);
    expect(p.sale_price_cents).toBe(Math.round(1500 * (2200 / 1900)));
  });

  it("is safe to apply twice", () => {
    const once = pricedIn({ ...product, price_usd_cents: 2200 }, "usd");
    expect(pricedIn(once, "usd")).toEqual(once);
  });

  it("ignores a dollar price on a free product", () => {
    expect(pricedIn({ price_cents: 0, price_usd_cents: 500 }, "usd").price_cents).toBe(0);
  });
});

describe("formatting", () => {
  it("formats each currency with its own symbol", () => {
    expect(formatMoney(1900, "eur")).toBe("€19.00");
    expect(formatMoney(1900, "usd")).toBe("$19.00");
  });

  it("never adds euros and dollars together", () => {
    const totals = addTo(addTo(addTo({}, "eur", 1000), "usd", 450), "eur", 200);
    expect(formatTotals(totals)).toBe("€12.00 + $4.50");
    expect(formatTotals({})).toBe("€0.00");
    expect(formatTotals({ usd: 900 })).toBe("$9.00");
  });

  it("treats anything unexpected as euros", () => {
    expect(asCurrency("USD")).toBe("usd");
    expect(asCurrency("gbp")).toBe("eur");
    expect(asCurrency(null)).toBe("eur");
  });

  it("shows listings in the buyer's currency", () => {
    const p = { price_cents: 1900, pay_what_you_want: false, price_usd_cents: 2200 };
    expect(listingPrice(p, new Date(), "usd").label).toBe("$22.00");
    expect(listingPrice(p, new Date(), "eur").label).toBe("€19.00");
    expect(listingPrice(p).label).toBe("€19.00");
  });
});
