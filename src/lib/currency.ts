// Buyers in Europe see and pay euros; everyone else sees and pays US dollars.
//
// Prices are stored in euros (products.price_cents). The dollar price is the
// same number (€19 → $19) unless the seller set their own
// (products.price_usd_cents), in which case a launch price follows the same
// ratio. Order-bump prices and fixed-amount coupons are always the same number
// in both currencies.
//
// The currency is chosen per request on the server (currency.server.ts) from
// the country Cloudflare reports, and a buyer can switch it themselves. Each
// sale records the currency it was actually charged in.

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

type Priced = {
  price_cents: number;
  sale_price_cents?: number | null;
  price_usd_cents?: number | null;
};

// How many dollar cents per euro cent for this product.
function usdRatio(p: Priced): number {
  return p.price_usd_cents && p.price_usd_cents > 0 && p.price_cents > 0 ? p.price_usd_cents / p.price_cents : 1;
}

// The product with its price (and launch price) in the given currency, so the
// existing price/checkout math runs unchanged on it.
export function pricedIn<T extends Priced>(p: T, currency: Currency): T {
  if (currency === "eur") return p;
  const ratio = usdRatio(p);
  if (ratio === 1) return p;
  return {
    ...p,
    price_cents: p.price_usd_cents!,
    sale_price_cents: p.sale_price_cents == null ? p.sale_price_cents : Math.round(p.sale_price_cents * ratio),
  };
}
