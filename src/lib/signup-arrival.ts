// How a would-be seller found Halvo, remembered in the browser until they
// create an account. Sign-up usually happens pages (or days) after landing,
// so the ad or post that brought them is only visible on that first page's
// URL; this keeps it until signup-source.functions.ts records it.
//
// Last tagged touch wins: a visit with UTM tags or from another site replaces
// what's stored, a plain internal visit never does. Only the referring
// site's origin is kept, never the full URL.
//
// SSR-safe: every function is a no-op without a browser.

import { z } from "zod";

export const signupArrivalSchema = z.object({
  utmSource: z.string().max(60).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmContent: z.string().max(100).optional(),
  referrer: z.string().max(200).optional(),
  landingPath: z.string().max(200).optional(),
});

export type SignupArrival = z.infer<typeof signupArrivalSchema>;

type Stored = SignupArrival & { at: number };
type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const KEY = "halvo:signup-arrival";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const clip = (v: string | null, max: number) => (v ? v.trim().slice(0, max) || undefined : undefined);

// What this page view says about where the visitor came from.
export function arrivalFromVisit(href: string, referrer: string): SignupArrival & { tagged: boolean } {
  const url = new URL(href);
  const params = url.searchParams;
  let ref: string | undefined;
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r && r.hostname.replace(/^www\./, "") !== url.hostname.replace(/^www\./, "")) ref = r.origin;
  } catch {
    ref = undefined;
  }
  const arrival: SignupArrival = {
    utmSource: clip(params.get("utm_source"), 60),
    utmCampaign: clip(params.get("utm_campaign"), 100),
    utmContent: clip(params.get("utm_content"), 100),
    referrer: ref,
    landingPath: url.pathname.slice(0, 200),
  };
  return { ...arrival, tagged: !!(arrival.utmSource || arrival.referrer) };
}

export function rememberArrival(
  href: string,
  referrer: string,
  storage = browserStorage(),
  now = Date.now(),
): void {
  try {
    if (!storage) return;
    const { tagged, ...arrival } = arrivalFromVisit(href, referrer);
    // An untagged internal visit only counts when nothing is known yet, so the
    // landing page is still recorded for people who typed the address.
    if (!tagged && readArrival(storage, now)) return;
    storage.setItem(KEY, JSON.stringify({ ...arrival, at: now } satisfies Stored));
  } catch {
    // Storage blocked: the sign-up is recorded as Direct.
  }
}

export function readArrival(storage = browserStorage(), now = Date.now()): SignupArrival | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (typeof stored?.at !== "number" || now - stored.at > MAX_AGE_MS) return null;
    const parsed = signupArrivalSchema.safeParse(stored);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
