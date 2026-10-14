// Cloudflare Web Analytics — the owner-side view of who visits the site.
//
// Set at deploy time:
//   VITE_CF_BEACON_TOKEN — the site token from
//   Cloudflare dashboard > Web Analytics > your site > Manage site
//
// Renders nothing at all unless that token is set, so local dev and any
// un-configured deploy send no beacon and contact no third party.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT BEHIND THE CONSENT BANNER
// ---------------------------------------------------------------------------
// Unlike the Meta/GA pixels in ad-pixels.ts, this is deliberately loaded for
// everyone, immediately. Cloudflare Web Analytics sets no cookies, writes
// nothing to localStorage, and builds no cross-site identifier or device
// fingerprint — so it isn't storing or accessing information on the visitor's
// device, which is the thing ePrivacy/GDPR requires consent for. That is the
// entire reason to prefer it: no banner means no "reject" clicks, which means
// the numbers aren't undercounted.
//
// Keep it that way. The moment a tool here needs a cookie, it belongs in
// ad-pixels.ts behind the banner instead.
//
// ---------------------------------------------------------------------------
// DO NOT ALSO ENABLE CLOUDFLARE'S AUTOMATIC SETUP
// ---------------------------------------------------------------------------
// If the domain is proxied through Cloudflare (orange cloud), Cloudflare can
// inject this same beacon for you with no code at all. Doing both loads it
// twice and double-counts every visit. Pick one:
//
//   * proxied through Cloudflare  -> use automatic setup, leave this unset
//   * served directly (e.g. Railway, DNS-only) -> set the token here
//
// ---------------------------------------------------------------------------
// WHAT IT WILL AND WON'T TELL YOU
// ---------------------------------------------------------------------------
// Gives: visits, page views, top pages, referrers/sources, countries,
// devices, browsers, and Core Web Vitals.
//
// Does NOT give: how long a visitor stayed, bounce rate, or funnels. Those
// need a session-based tool (Plausible, GA4) or session recordings
// (Microsoft Clarity).

const CF_BEACON_TOKEN = import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined;

export function CloudflareAnalytics() {
  const token = CF_BEACON_TOKEN?.trim();
  if (!token) return null;

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      // Cloudflare reads its config off this attribute as JSON. Built with
      // JSON.stringify so a token containing a quote can't break out of the
      // attribute and inject markup.
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
