// Remembers, in this browser only, which purchases were made here — so a buyer
// who closes the tab can get back to their download without an email and
// without an account.
//
// Safe by construction: a transaction id is already a capability this browser
// legitimately holds (it came back from its own checkout), and the server
// re-verifies status and refund on every load. Nothing here grants access that
// the buyer didn't already have; it only stops them losing it.
//
// Deliberately no personal data: id, product name, date. Nothing that would
// matter on a shared computer beyond what the download link itself reveals.

import { BRAND_KEY } from "@/lib/site";

const KEY = `${BRAND_KEY}-purchases`;
const MAX = 50;

export type LocalPurchase = {
  transactionId: string;
  productName: string;
  /** ISO date — display only. */
  at: string;
};

function read(): LocalPurchase[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate anything malformed rather than throwing on a corrupted key.
    return parsed.filter(
      (p): p is LocalPurchase =>
        !!p && typeof p === "object" &&
        typeof (p as LocalPurchase).transactionId === "string" &&
        typeof (p as LocalPurchase).productName === "string",
    );
  } catch {
    // Private mode, blocked storage, quota — never break the page over this.
    return [];
  }
}

export function listLocalPurchases(): LocalPurchase[] {
  return read();
}

export function rememberPurchase(entry: Omit<LocalPurchase, "at"> & { at?: string }): void {
  try {
    const existing = read().filter((p) => p.transactionId !== entry.transactionId);
    const next = [{ ...entry, at: entry.at ?? new Date().toISOString() }, ...existing].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable. The email and the success URL are still the paths.
  }
}

export function forgetLocalPurchases(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
