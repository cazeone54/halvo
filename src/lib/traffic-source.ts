// Turns a raw referrer URL into a label a seller can act on. Pure, so it's
// testable without a browser.
//
// Sellers can currently see revenue and sales but have no idea *where* buyers
// came from, which is the first question anyone asks. An explicit utm_source
// always wins; otherwise we fall back to the referring host.

// Link shims and app wrappers that hide the real origin.
const HOST_ALIASES: Record<string, string> = {
  "t.co": "x.com",
  "l.instagram.com": "instagram.com",
  "lm.facebook.com": "facebook.com",
  "l.facebook.com": "facebook.com",
  "m.facebook.com": "facebook.com",
  "out.reddit.com": "reddit.com",
  "www.google.com": "google",
  "news.google.com": "google",
  "com.google.android.gm": "gmail",
  "mail.google.com": "gmail",
  "away.vk.com": "vk.com",
  "youtu.be": "youtube.com",
};

const DIRECT = "Direct";

export function normalizeTrafficSource(input: {
  referrer?: string | null;
  utmSource?: string | null;
  selfHost?: string | null;
}): string {
  const utm = input.utmSource?.trim().toLowerCase();
  if (utm) return utm.slice(0, 60);

  const referrer = input.referrer?.trim();
  if (!referrer) return DIRECT;

  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return DIRECT;
  }
  if (!host) return DIRECT;

  const aliased = HOST_ALIASES[host] ?? host.replace(/^www\./, "");

  // Arriving from our own pages isn't a traffic source — that's someone
  // browsing the storefront or coming back to a link they already had.
  const self = input.selfHost?.toLowerCase().replace(/^www\./, "");
  if (self && (aliased === self || host === self)) return DIRECT;

  return aliased.slice(0, 60);
}
