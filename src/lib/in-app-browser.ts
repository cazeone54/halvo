// Which app's built-in browser a visitor is in, from the user agent.
//
// A tap on an Instagram or Facebook ad opens the site inside that app, not in
// Safari or Chrome. Google refuses its sign-in in these embedded browsers
// ("disallowed_useragent"), so "Continue with Google" fails there — and that's
// where every ad visitor arrives. The login page uses this to lead with the
// emailed code instead and to offer a way out to the real browser.
//
// Pure, so it's tested against real user agents rather than assumed.

export type InAppBrowser = { app: string; android: boolean; ios: boolean };

// Checked in order: Messenger and Threads before Facebook and Instagram, since
// their user agents carry the parent app's marks too.
const APPS: Array<[RegExp, string]> = [
  [/FBAN\/MessengerForiOS|FB_IAB\/MESSENGER|\bOrca-Android\b/i, "Messenger"],
  [/\bBarcelona\b/, "Threads"],
  [/\bInstagram\b/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/, "Facebook"],
  [/musical_ly|BytedanceWebview|\bTikTok\b|\btrill\b/i, "TikTok"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Snapchat/i, "Snapchat"],
  [/\bPinterest\b/i, "Pinterest"],
];

export function detectInAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  if (!ua) return null;
  for (const [re, app] of APPS) {
    if (re.test(ua)) return { app, android: /Android/i.test(ua), ios: /iPhone|iPad|iPod/i.test(ua) };
  }
  return null;
}

// Android can be asked to open a page in Chrome from inside an app's browser;
// iOS can't (the visitor uses the app's own "Open in browser" menu instead).
// The fallback URL keeps the visitor on the page if Chrome isn't installed.
export function openInChromeUrl(pageUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}
