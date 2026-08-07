import { BRAND_KEY } from "@/lib/site";

// A visitor's cookie/tracking choice, remembered in localStorage. "granted"
// loads the ad pixels; "denied" (or no choice) loads nothing. Required for the
// EU — non-essential tracking must not run before explicit consent.
export type Consent = "granted" | "denied";

const KEY = `${BRAND_KEY}:consent`;

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: Consent): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Private mode / storage disabled — the choice just won't persist.
  }
}
