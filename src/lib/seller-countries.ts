// Countries a seller can connect a Stripe account from. Stripe creates the
// account in the country the seller lives in (or where their business is
// registered) and it can't be changed later, so Halvo asks before creating it.
// Without one, Stripe falls back to the platform's own country (Bulgaria) and a
// seller elsewhere can't finish onboarding with their own ID and bank.
//
// Verified 2026-10-15 against Stripe: each of these can be created by this
// platform with Halvo's account settings. India is refused, so it's left out.
export const SELLER_COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "LV", name: "Latvia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MY", name: "Malaysia" },
  { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TH", name: "Thailand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
] as const;

export type SellerCountry = (typeof SELLER_COUNTRIES)[number]["code"];

const CODES = new Set<string>(SELLER_COUNTRIES.map((c) => c.code));

export function isSellerCountry(code: unknown): code is SellerCountry {
  return typeof code === "string" && CODES.has(code);
}

// Languages that point to one country on the list, for browsers that report a
// bare language ("de") rather than a region ("de-AT"). English and Spanish are
// spoken in too many listed countries to guess from.
const LANGUAGE_COUNTRY: Record<string, SellerCountry> = {
  bg: "BG", cs: "CZ", da: "DK", de: "DE", el: "GR", et: "EE", fi: "FI", fr: "FR", hr: "HR", hu: "HU",
  it: "IT", ja: "JP", lt: "LT", lv: "LV", nb: "NO", nl: "NL", nn: "NO", no: "NO", pl: "PL", pt: "PT",
  ro: "RO", sk: "SK", sl: "SI", sv: "SE", th: "TH",
};

// A starting suggestion for the country picker from the browser's language
// ("en-US" → US, "bg" → BG). Only a suggestion: the seller confirms it, and an
// empty result means "make them choose".
export function guessSellerCountry(language: string | null | undefined): SellerCountry | "" {
  if (!language) return "";
  const [lang, region] = language.split(/[-_]/);
  const fromRegion = region?.toUpperCase();
  if (isSellerCountry(fromRegion)) return fromRegion;
  return LANGUAGE_COUNTRY[lang?.toLowerCase() ?? ""] ?? "";
}
