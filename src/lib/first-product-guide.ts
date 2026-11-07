import { BRAND_KEY } from "@/lib/site";

// A new seller with no products is sent to the step-by-step first-product
// guide (/dashboard/start) instead of the full dashboard: 13 of the first 44
// accounts signed in, saw the dashboard, and left without starting anything.
// "Skip" is remembered in this browser so it never traps anyone.
const SKIPPED_KEY = `${BRAND_KEY}:first-product-guide:skipped`;

export function guideSkipped(): boolean {
  try {
    return window.localStorage.getItem(SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

export function skipGuide(): void {
  try {
    window.localStorage.setItem(SKIPPED_KEY, "1");
  } catch {
    // Storage blocked: they'll be offered the guide again next time, nothing worse.
  }
}
