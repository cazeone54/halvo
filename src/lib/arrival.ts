// How a visitor got here, read from the browser.
//
// Shared by checkout (which attributes a SALE) and the product page (which
// attributes a VIEW) so there is one definition of "where did this person come
// from" rather than two that can drift apart.
//
// SSR-safe: returns an empty object on the server.

export interface Arrival {
  referrer?: string;
  utmSource?: string;
}

/**
 * `document.referrer` belongs to the DOCUMENT, not to the current route — so a
 * client-side navigation inside the app does NOT overwrite it, and it keeps
 * pointing at whatever external page the visitor originally arrived from. That
 * is what we want: someone landing on /discover from Instagram and then
 * clicking through to a product still attributes to instagram.
 *
 * `utm_source` is read from the CURRENT url, which is the right scope for it —
 * it's a per-link tag, and a tagged link is the page they landed on.
 *
 * Both are normalised server-side (see record-source.server.ts); nothing here
 * is trusted as a label, and the raw referrer is never stored.
 */
export function captureArrival(): Arrival {
  if (typeof window === "undefined") return {};
  const utmSource = new URLSearchParams(window.location.search).get("utm_source") ?? undefined;
  return {
    referrer: document.referrer || undefined,
    utmSource: utmSource || undefined,
  };
}
