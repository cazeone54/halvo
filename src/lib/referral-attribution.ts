const REF_KEY = "halvo_ref";
const REF_AT_KEY = "halvo_ref_at";
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref || ref.length < 3 || ref.length > 32) return;
  window.localStorage.setItem(REF_KEY, ref);
  window.localStorage.setItem(REF_AT_KEY, String(Date.now()));
}

export function getActiveReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = window.localStorage.getItem(REF_KEY);
  const at = Number(window.localStorage.getItem(REF_AT_KEY) ?? "0");
  if (!code || !at) return null;
  if (Date.now() - at > ATTRIBUTION_WINDOW_MS) return null;
  return code;
}
