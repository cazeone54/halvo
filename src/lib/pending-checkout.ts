// Some payment methods (Revolut Pay, iDEAL, Bancontact, Klarna…) send the
// buyer away to their app or bank to approve the payment, and Stripe then
// brings them back to /checkout/return. The checkout page is gone by then, so
// what it knew is saved here first and read back there to finish the purchase
// exactly as an in-page payment would (email, final-sale tick, referral, and
// where the buyer originally came from).
//
// localStorage rather than sessionStorage: on phones the approval often happens
// in another app and the browser may come back in a new tab. Entries are short
// lived and removed once used. If nothing is found, the purchase still
// completes, using the email Stripe has on the payment.

export type PendingCheckout = {
  productId: string;
  subscriptionId: string | null;
  email: string;
  acknowledged: boolean;
  referralCode?: string;
  referrer?: string;
  utmSource?: string;
  // The product page to go back to if the payment wasn't completed.
  back: string;
  savedAt: number;
};

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "halvo:pending-checkout";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function savePendingCheckout(entry: PendingCheckout, storage = browserStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Storage blocked: the return page falls back to Stripe's copy of the email.
  }
}

// The saved checkout for this product, if it's recent; otherwise null.
export function readPendingCheckout(
  productId: string | undefined,
  storage = browserStorage(),
  now = Date.now(),
): PendingCheckout | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<PendingCheckout>;
    if (!entry || typeof entry !== "object") return null;
    if (!productId || entry.productId !== productId) return null;
    if (typeof entry.savedAt !== "number" || now - entry.savedAt > MAX_AGE_MS) return null;
    if (typeof entry.email !== "string") return null;
    return entry as PendingCheckout;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(storage = browserStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

// Only a path on this site may be used to send the buyer back ("/p/…"), never
// another site: the value travels through a URL anyone could edit.
export function safeBackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/discover";
  return raw;
}

// Where Stripe sends the buyer after approving (or abandoning) the payment.
// Carries no personal data: Stripe adds the payment's own id to it.
export function buildReturnUrl(
  origin: string,
  p: { productId: string; subscriptionId: string | null; acknowledged: boolean; back: string },
): string {
  const url = new URL("/checkout/return", origin);
  url.searchParams.set("pid", p.productId);
  if (p.subscriptionId) url.searchParams.set("sub", p.subscriptionId);
  if (p.acknowledged) url.searchParams.set("ack", "1");
  url.searchParams.set("back", safeBackPath(p.back));
  return url.toString();
}
