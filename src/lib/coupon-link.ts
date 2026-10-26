// A product link with a discount already applied: halvo.io/p/<slug>?coupon=CODE.
// Built by the dashboard, the follow-up emails and the download-page offer;
// read by the product page. Both halves live here so they can't drift apart.

export const COUPON_PARAM = "coupon";

// Codes are created as 3–32 characters and stored upper-case. Anything else in
// the address is ignored rather than shown back to the buyer as an error: a
// mangled link should still open the product at its normal price.
const CODE = /^[A-Za-z0-9_-]{3,32}$/;

export function readCouponParam(search: Record<string, unknown>): string | undefined {
  const raw = search[COUPON_PARAM];
  if (typeof raw !== "string") return undefined;
  const code = raw.trim();
  return CODE.test(code) ? code.toUpperCase() : undefined;
}

export function couponLink(baseUrl: string, slug: string, code?: string | null): string {
  const url = `${baseUrl.replace(/\/+$/, "")}/p/${encodeURIComponent(slug)}`;
  return code && CODE.test(code) ? `${url}?${COUPON_PARAM}=${encodeURIComponent(code.toUpperCase())}` : url;
}
