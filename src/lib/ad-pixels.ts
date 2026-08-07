// Ad/analytics pixels — Meta Pixel and/or Google Analytics 4. Loaded ONLY after
// the visitor consents (see consent-banner.tsx), and only if an id is provided
// via env. With no ids set (e.g. local dev), nothing loads and the consent
// banner never appears — so there's zero tracking and zero prompt until you
// actually configure a campaign.
//
// SSR-safe: every browser-global access is inside a function guarded for the
// server, so this module can be imported from server-rendered routes (that's
// why it's not named *.client.ts, which TanStack blocks from server imports).
//
// Set at deploy time:
//   VITE_META_PIXEL_ID       — Meta (Facebook/Instagram) Pixel id
//   VITE_GA_MEASUREMENT_ID   — GA4 measurement id (G-XXXXXXX)

type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  callMethod?: (...args: unknown[]) => void;
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

// True only when at least one pixel is configured — the consent banner keys off
// this, so there's nothing to consent to (and no banner) until you set an id.
export function analyticsConfigured(): boolean {
  return Boolean(META_PIXEL_ID || GA_MEASUREMENT_ID);
}

let loaded = false;

// Idempotently inject whichever pixels are configured. Safe to call more than
// once (returning visitors + the Accept click both call it).
export function loadPixels(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID);
  if (GA_MEASUREMENT_ID) loadGa(GA_MEASUREMENT_ID);
}

function loadMetaPixel(id: string): void {
  if (window.fbq) return;
  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else (n.queue as unknown[]).push(args);
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
  window._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function loadGa(id: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

// Fire a conversion/standard event to whichever pixels are loaded. A no-op if
// the visitor hasn't consented (pixels never loaded), which keeps it GDPR-safe.
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (window.fbq) window.fbq("track", name, params);
  if (window.gtag) window.gtag("event", name, params);
}
