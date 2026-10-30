import { normalizeUrl } from "@/lib/link-in-bio";

// How a seller's shop page looks beyond their name and colour: a banner picture
// across the top, and an announcement bar — one short line ("New course out
// Friday") that can link somewhere.

export const MAX_ANNOUNCEMENT = 140;
export const MAX_BANNER_MB = 5;

export type Announcement = { text: string; url: string | null };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Empty text means "no announcement", which is a valid answer. The link is the
// same kind any seller link on a public page must be (see normalizeUrl).
export function normalizeAnnouncement(input: { text: string; url: string }): Result<Announcement | null> {
  const text = input.text.replace(/\s+/g, " ").trim();
  const rawUrl = input.url.trim();
  if (!text) {
    return rawUrl ? { ok: false, error: "Add the announcement text, or clear its link too." } : { ok: true, value: null };
  }
  if (text.length > MAX_ANNOUNCEMENT) {
    return { ok: false, error: `Keep the announcement to ${MAX_ANNOUNCEMENT} characters.` };
  }
  if (!rawUrl) return { ok: true, value: { text, url: null } };
  const url = normalizeUrl(rawUrl);
  if (!url.ok) return url;
  return { ok: true, value: { text, url: url.value } };
}

// What the shop shows from whatever is stored: nothing unless it still passes
// the rules above, so a value written around the app can't reach the page.
export function announcementForDisplay(text: unknown, url: unknown): Announcement | null {
  if (typeof text !== "string") return null;
  const r = normalizeAnnouncement({ text, url: typeof url === "string" ? url : "" });
  return r.ok ? r.value : null;
}
