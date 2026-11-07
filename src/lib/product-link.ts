// A link a seller delivers instead of a file (Notion, Canva, Google Drive…).
// Pure, so the rules about what counts as a usable link are tested.

export const LINK_MAX = 2000;
export const LINK_LABEL_MAX = 120;

// The seller's link, tidied, or the reason it can't be used. A missing
// "https://" is added (people paste "notion.so/…"); anything that isn't a
// plain web address is refused — the buyer is sent straight to it.
export function normalizeDeliveryUrl(raw: string): { url: string } | { error: string } {
  let s = raw.trim();
  if (!s) return { error: "Paste the link your buyers should get." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "That doesn't look like a link. Copy it from the address bar or the Share button and paste it here." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { error: "Use a web link that starts with https://" };
  }
  if (!u.hostname.includes(".") || u.username || u.password) {
    return { error: "That doesn't look like a link. Copy it from the address bar or the Share button and paste it here." };
  }
  if (u.href.length > LINK_MAX) return { error: "That link is too long." };
  return { url: u.href };
}

// What the buyer's button says: the seller's label, or where it goes.
export function linkButtonLabel(label: string | null | undefined, url: string): string {
  const own = label?.trim();
  if (own) return own;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/(^|\.)notion\.(so|site)$/.test(host)) return "Open in Notion";
    if (/(^|\.)canva\.com$/.test(host)) return "Open in Canva";
    if (/^(drive|docs)\.google\.com$/.test(host)) return "Open in Google Drive";
    if (/(^|\.)dropbox\.com$/.test(host)) return "Open in Dropbox";
    if (/(^|\.)figma\.com$/.test(host)) return "Open in Figma";
    return `Open ${host}`;
  } catch {
    return "Open your link";
  }
}
