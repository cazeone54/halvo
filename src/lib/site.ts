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

// ─── Currency ───────────────────────────────────────────────────────────────
// EUR because every connected account settles in EUR (all BG). Charging in a
// non-settlement currency means a conversion on every sale — and under direct
// charges the SELLER pays it. EUR also unlocks the local payment methods the
// connected accounts already have enabled (iDEAL, Bancontact, EPS, BLIK), all
// of which are EUR-only and were simply never offered while prices were USD.
//
// Defined once: CURRENCY goes to Stripe, CURRENCY_CODE to schema.org/analytics,
// CURRENCY_SYMBOL to anything a human reads.
export const CURRENCY = "eur";
export const CURRENCY_CODE = "EUR";
export const CURRENCY_SYMBOL = "€";

// ─── Optional features ──────────────────────────────────────────────────────
// The AI product-copy helper ("Generate with AI"). Off: sellers don't need it to
// list a product, and it needs a funded Anthropic account to work at all. Set
// to true to bring back the dashboard button, the server function and its
// mentions on /features and the pricing card together.
export const AI_COPYWRITER_ENABLED = false;
