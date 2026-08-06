// Brand constants — change these and the global rename is done.
export const BRAND_NAME = "Halvo";
export const BRAND_KEY = "halvo"; // lowercase prefix for localStorage keys / event names

// Single source of truth for the public site URL — used in og:url, canonical,
// sitemap entries, og:image, etc. Set VITE_SITE_URL at build/deploy time to your
// real domain (Vite inlines it into both the client and server bundles); it
// falls back to the placeholder in local dev. Trailing slash stripped so joins
// like `${BASE_URL}/features` never double up.
export const BASE_URL = (import.meta.env.VITE_SITE_URL ?? "https://halvo.io").replace(/\/+$/, "");

// Derived from BASE_URL so the domain only ever lives in one place.
export const BRAND_DOMAIN = BASE_URL.replace(/^https?:\/\//, "");
export const BRAND_EMAIL = `hello@${BRAND_DOMAIN}`;
