// Buyers in Europe see and pay euros; everyone else sees and pays US dollars.
//
// Prices are stored in euros (products.price_cents) and converted for dollar
// buyers, so a seller keeps roughly the same money whichever currency a sale
// comes in. A seller can set an exact dollar price instead
// (products.price_usd_cents); a launch price then follows the same ratio.
// Order bumps and fixed-amount coupons are converted the same way.
//
// The currency is chosen per request on the server (currency.server.ts) from
// the country Cloudflare reports, and a buyer can switch it themselves. Each
// sale records the currency it was actually charged in.

import { MIN_CHARGE_CENTS } from "@/lib/fees";

export type Currency = "eur" | "usd";

export const DEFAULT_CURRENCY: Currency = "eur";

export const CURRENCY_META: Record<Currency, { code: "EUR" | "USD"; symbol: string; name: string }> = {
  eur: { code: "EUR", symbol: "€", name: "euros" },
  usd: { code: "USD", symbol: "$", name: "US dollars" },
};

// The buyer's own choice (the "Pay in … instead" link). Always wins.
export const CURRENCY_COOKIE = "halvo_currency";
// What the browser worked out from its time zone on the first visit (see
// detectBrowserCurrency); used when the request itself doesn't say where the
// visitor is.
export const AUTO_CURRENCY_COOKIE = "halvo_currency_auto";

export function isCurrency(v: unknown): v is Currency {
  return v === "eur" || v === "usd";
}

export function asCurrency(v: unknown): Currency {
  const lower = typeof v === "string" ? v.toLowerCase() : v;
  return isCurrency(lower) ? lower : DEFAULT_CURRENCY;
}

// EU/EEA, the UK, Switzerland and the rest of geographic Europe.
const EUROPE = new Set(
  (
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE " +
    "IS LI NO CH GB UK AD MC SM VA ME XK AL BA MK RS MD UA GI FO IM JE GG AX"
  ).split(" "),
);

// Country (ISO 3166 alpha-2, as Cloudflare sends it) → currency. Unknown or
// missing country (local development, direct requests) keeps euros.
export function currencyForCountry(country: string | null | undefined): Currency {
  const c = country?.trim().toUpperCase();
  if (!c || c === "XX" || c === "T1") return DEFAULT_CURRENCY;
  return EUROPE.has(c) ? "eur" : "usd";
}

// From the browser's languages (Accept-Language, or navigator.languages): the
// first one naming a region, e.g. "en-US" → dollars, "en-GB"/"de-DE" → euros.
// Null when none names a region ("en", "de").
export function currencyFromLanguages(langs: string | readonly string[] | null | undefined): Currency | null {
  const list = typeof langs === "string" ? langs.split(",") : (langs ?? []);
  for (const raw of list) {
    const tag = raw.split(";")[0].trim();
    const region = tag.split(/[-_]/)[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return currencyForCountry(region);
  }
  return null;
}

// From the browser's time zone ("Europe/Sofia" → euros, "America/Chicago" →
// dollars). Null when it says nothing about place ("UTC", "Etc/GMT+2").
export function currencyFromTimeZone(tz: string | null | undefined): Currency | null {
  if (!tz || !tz.includes("/") || tz.startsWith("Etc/")) return null;
  if (tz.startsWith("Europe/") || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe|Faeroe)$/.test(tz)) return "eur";
  return "usd";
}

// Browser only, once per visitor: remember the currency the time zone points
// to, for the server to use from now on. Returns true when that differs from
// what the server could tell from the browser's language alone, i.e. this
// first page was priced in the wrong currency and should be reloaded.
export function detectBrowserCurrency(): boolean {
  if (typeof document === "undefined") return false;
  try {
    if (document.cookie.includes(`${CURRENCY_COOKIE}=`) || document.cookie.includes(`${AUTO_CURRENCY_COOKIE}=`)) {
      return false;
    }
    const fromZone = currencyFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (!fromZone) return false;
    document.cookie = `${AUTO_CURRENCY_COOKIE}=${fromZone}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    return fromZone !== (currencyFromLanguages(languages) ?? DEFAULT_CURRENCY);
  } catch {
    return false;
  }
}

export function formatMoney(cents: number, currency: Currency = DEFAULT_CURRENCY): string {
  return `${CURRENCY_META[currency].symbol}${(cents / 100).toFixed(2)}`;
}

// Totals across sales charged in different currencies, which are never added
// together: "€120.00 + $45.00". Empty → "€0.00".
export type MoneyTotals = Partial<Record<Currency, number>>;

export function addTo(totals: MoneyTotals, currency: string | null | undefined, cents: number): MoneyTotals {
  const c = asCurrency(currency);
  totals[c] = (totals[c] ?? 0) + cents;
  return totals;
}

export function formatTotals(totals: MoneyTotals): string {
  const parts = (Object.keys(CURRENCY_META) as Currency[])
    .filter((c) => (totals[c] ?? 0) !== 0)
    .map((c) => formatMoney(totals[c]!, c));
  return parts.length ? parts.join(" + ") : formatMoney(0);
}

// For sorting and bar lengths only (never shown as money): a rough single
// number so a product with $90 isn't ranked below one with €10.
export function totalsWeight(totals: MoneyTotals): number {
  return (totals.eur ?? 0) + (totals.usd ?? 0);
}

// Money that has ALREADY been charged, restated in one currency so a seller's
// dashboard can show a single figure instead of "€120.00 + $45.00".
//
// Deliberately NOT eurToUsdCents: that shapes a PRICE (€19.99 → $22.99, whole
// euros to whole dollars) which would be wrong here — €19.99 already taken is
// worth what it's worth, not what it would have been priced at. This is a
// straight rate conversion and is for display only; never charge or pay out
// from it, and never let it replace the real per-currency figures in an export.
export function convertCents(cents: number, from: Currency, to: Currency): number {
  if (from === to || !Number.isFinite(cents)) return cents;
  return to === "usd" ? Math.round(cents * USD_PER_EUR) : Math.round(cents / USD_PER_EUR);
}

// A per-currency breakdown collapsed into one currency.
export function totalsIn(totals: MoneyTotals, to: Currency): number {
  return (Object.keys(CURRENCY_META) as Currency[]).reduce(
    (sum, from) => sum + convertCents(totals[from] ?? 0, from, to),
    0,
  );
}

// True when collapsing would actually convert something — i.e. there is money
// in a currency other than the one being shown, so the figure needs its
// "converted at this rate" note. No note when nothing was converted.
export function totalsNeedConversion(totals: MoneyTotals, to: Currency): boolean {
  return (Object.keys(CURRENCY_META) as Currency[]).some((c) => c !== to && (totals[c] ?? 0) !== 0);
}

// Dollars per euro, fixed in the code rather than fetched, so a product's
// price doesn't move from day to day under buyers (or in search results).
// ECB reference rate was 1.1253 on 2026-10-16; the rest covers Stripe's cost
// for converting a dollar sale into a euro payout, so the seller nets about
// what they asked for. Worth reviewing every few months.
export const USD_PER_EUR = 1.14;

// A euro amount as the dollar price buyers see. Keeps the shape of the price
// the seller chose: whole euros stay whole dollars, €x.99 stays $x.99.
export function eurToUsdCents(eurCents: number): number {
  if (!Number.isFinite(eurCents) || eurCents <= 0) return 0;
  const raw = eurCents * USD_PER_EUR;
  const tail = eurCents % 100;
  let out: number;
  if (tail === 0) out = Math.round(raw / 100) * 100; // €19 → $22
  else if (tail === 99) out = Math.round(raw / 100) * 100 - 1; // €19.99 → $22.99
  else if (tail === 50) out = Math.round(raw / 50) * 50; // €4.50 → $5.00
  else out = Math.round(raw);
  return Math.max(MIN_CHARGE_CENTS, out);
}

// A fixed euro amount a seller set — an order bump, a "€5 off" coupon — in the
// buyer's currency.
export function amountIn(eurCents: number, currency: Currency): number {
  return currency === "usd" ? eurToUsdCents(eurCents) : eurCents;
}

type CouponAmounts = { percent_off: number | null; amount_off_cents: number | null };

// A percentage coupon needs no conversion; a fixed amount does.
export function couponIn<T extends CouponAmounts>(coupon: T, currency: Currency): T {
  if (currency === "eur" || !coupon.amount_off_cents) return coupon;
  return { ...coupon, amount_off_cents: eurToUsdCents(coupon.amount_off_cents) };
}

type Priced = {
  price_cents: number;
  sale_price_cents?: number | null;
  price_usd_cents?: number | null;
  // Set by pricedIn so converting twice can't double a buyer's price.
  _pricedIn?: Currency;
};

// What this product costs a dollar buyer: the seller's own dollar price if
// they set one, otherwise the converted euro price. A free product is free in
// both currencies, whatever dollar price may be left over on the row.
export function usdPriceCents(p: Priced): number {
  if (p.price_cents <= 0) return 0;
  return p.price_usd_cents && p.price_usd_cents > 0 ? p.price_usd_cents : eurToUsdCents(p.price_cents);
}

// The product with its price (and launch price) in the given currency, so the
// existing price/checkout math runs unchanged on it.
export function pricedIn<T extends Priced>(p: T, currency: Currency): T {
  if (currency === "eur" || p._pricedIn === currency) return p;
  const priceCents = usdPriceCents(p);
  // A launch price follows whatever the seller's dollar price implies, so an
  // exact dollar price discounts by the same proportion the euro one does.
  const salePriceCents =
    p.sale_price_cents == null
      ? p.sale_price_cents
      : p.price_usd_cents && p.price_usd_cents > 0 && p.price_cents > 0
        ? Math.round(p.sale_price_cents * (p.price_usd_cents / p.price_cents))
        : eurToUsdCents(p.sale_price_cents);
  return { ...p, price_cents: priceCents, sale_price_cents: salePriceCents, _pricedIn: currency };
}
