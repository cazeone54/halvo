// The storefront as a link-in-bio page: social profiles, the seller's own
// links, and the addresses that can't be anyone's handle. Pure — shared by the
// settings form, the server that saves it, and the public page.

export const MAX_BIO_LINKS = 6;
export const MAX_FEATURED = 3;
export const MAX_LINK_TITLE = 60;
const MAX_URL = 500;

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "x" | "facebook" | "linkedin" | "website";

type PlatformSpec = {
  id: SocialPlatform;
  label: string;
  placeholder: string;
  // Hosts a pasted link must be on (without "www." / "m."). Empty = any site.
  hosts: string[];
  // A bare username, and how it becomes a profile link.
  username?: RegExp;
  profileUrl?: (name: string) => string;
};

export const SOCIAL_PLATFORMS: PlatformSpec[] = [
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "@yourname",
    hosts: ["instagram.com"],
    username: /^[A-Za-z0-9._]{1,30}$/,
    profileUrl: (n) => `https://www.instagram.com/${n}/`,
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "@yourname",
    hosts: ["tiktok.com"],
    username: /^[A-Za-z0-9._]{2,24}$/,
    profileUrl: (n) => `https://www.tiktok.com/@${n}`,
  },
  {
    id: "youtube",
    label: "YouTube",
    placeholder: "@yourchannel",
    hosts: ["youtube.com", "youtu.be"],
    username: /^[A-Za-z0-9._-]{3,30}$/,
    profileUrl: (n) => `https://www.youtube.com/@${n}`,
  },
  {
    id: "x",
    label: "X",
    placeholder: "@yourname",
    hosts: ["x.com", "twitter.com"],
    username: /^[A-Za-z0-9_]{1,15}$/,
    profileUrl: (n) => `https://x.com/${n}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "Link to your page",
    hosts: ["facebook.com", "fb.com"],
    username: /^[A-Za-z0-9.]{5,50}$/,
    profileUrl: (n) => `https://www.facebook.com/${n}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "Link to your profile",
    hosts: ["linkedin.com"],
    username: /^[A-Za-z0-9-]{3,100}$/,
    profileUrl: (n) => `https://www.linkedin.com/in/${n}`,
  },
  { id: "website", label: "Website", placeholder: "yoursite.com", hosts: [] },
];

export type SocialLinks = Partial<Record<SocialPlatform, string>>;
export type BioLink = { id: string; title: string; url: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// A link a stranger can put on a public Halvo page: http(s) only (never
// javascript: or data:), a real hostname, a sane length. A missing scheme gets
// https://, since that's how people type addresses.
export function normalizeUrl(raw: string): Result<string> {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Add a link." };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Links must start with http:// or https://." };
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".") || host === "localhost") {
    return { ok: false, error: "That doesn't look like a website address." };
  }
  if (url.username || url.password) return { ok: false, error: "That link can't contain a login." };
  const out = url.toString();
  if (out.length > MAX_URL) return { ok: false, error: "That link is too long." };
  return { ok: true, value: out };
}

const bareHost = (host: string) => host.toLowerCase().replace(/^(www|m|mobile)\./, "");

// "@maria", "maria", or a pasted profile link → one canonical profile link.
// Empty means "remove it", which is a valid answer.
export function normalizeSocial(platform: SocialPlatform, raw: string): Result<string | null> {
  const spec = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  if (!spec) return { ok: false, error: "Unknown platform." };
  const input = raw.trim();
  if (!input) return { ok: true, value: null };

  // Usernames can contain dots ("maria.lopez"), so a dot alone doesn't make a
  // link. A slash, a scheme, or the platform's own domain does.
  const first = bareHost(input.replace(/^[a-z]+:\/\//i, "").split("/")[0]);
  const looksLikeLink =
    spec.id === "website" ||
    input.includes("/") ||
    spec.hosts.some((h) => first === h || first.endsWith(`.${h}`));
  if (!looksLikeLink && spec.username && spec.profileUrl) {
    const name = input.replace(/^@/, "");
    if (!spec.username.test(name)) return { ok: false, error: `That isn't a valid ${spec.label} username.` };
    return { ok: true, value: spec.profileUrl(name) };
  }

  const url = normalizeUrl(input);
  if (!url.ok) return url;
  if (spec.hosts.length > 0) {
    const host = bareHost(new URL(url.value).hostname);
    if (!spec.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { ok: false, error: `That link isn't on ${spec.label}.` };
    }
  }
  return { ok: true, value: url.value.replace(/^http:/, "https:") };
}

export function normalizeSocialLinks(input: Partial<Record<string, string>>): Result<SocialLinks> {
  const out: SocialLinks = {};
  for (const spec of SOCIAL_PLATFORMS) {
    const raw = input[spec.id];
    if (raw == null) continue;
    const r = normalizeSocial(spec.id, raw);
    if (!r.ok) return { ok: false, error: `${spec.label}: ${r.error}` };
    if (r.value) out[spec.id] = r.value;
  }
  return { ok: true, value: out };
}

// Read back from the database, where anything could be: keep only known
// platforms whose value still passes, in display order.
export function socialLinksForDisplay(stored: unknown): Array<{ platform: SocialPlatform; label: string; url: string }> {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return [];
  const out = [];
  for (const spec of SOCIAL_PLATFORMS) {
    const v = (stored as Record<string, unknown>)[spec.id];
    if (typeof v !== "string") continue;
    const r = normalizeSocial(spec.id, v);
    if (r.ok && r.value) out.push({ platform: spec.id, label: spec.label, url: r.value });
  }
  return out;
}

const LINK_ID = /^[A-Za-z0-9-]{8,40}$/;

// The seller's own buttons. An id is kept across saves so click counts stay
// attached to the right link when they're reordered or retitled.
export function normalizeBioLinks(
  input: Array<{ id?: string | null; title: string; url: string }>,
  newId: () => string = () => crypto.randomUUID(),
): Result<BioLink[]> {
  if (input.length > MAX_BIO_LINKS) return { ok: false, error: `You can add up to ${MAX_BIO_LINKS} links.` };
  const seen = new Set<string>();
  const out: BioLink[] = [];
  for (const [i, link] of input.entries()) {
    const title = link.title.trim().replace(/\s+/g, " ");
    if (!title) return { ok: false, error: `Link ${i + 1}: add a title.` };
    if (title.length > MAX_LINK_TITLE) return { ok: false, error: `Link ${i + 1}: keep the title under ${MAX_LINK_TITLE} characters.` };
    const url = normalizeUrl(link.url);
    if (!url.ok) return { ok: false, error: `Link ${i + 1}: ${url.error}` };
    let id = link.id && LINK_ID.test(link.id) && !seen.has(link.id) ? link.id : newId();
    while (seen.has(id)) id = newId();
    seen.add(id);
    out.push({ id, title, url: url.value });
  }
  return { ok: true, value: out };
}

export function bioLinksForDisplay(stored: unknown): BioLink[] {
  if (!Array.isArray(stored)) return [];
  const out: BioLink[] = [];
  for (const item of stored.slice(0, MAX_BIO_LINKS)) {
    if (!item || typeof item !== "object") continue;
    const { id, title, url } = item as Record<string, unknown>;
    if (typeof id !== "string" || !LINK_ID.test(id) || typeof title !== "string" || typeof url !== "string") continue;
    const u = normalizeUrl(url);
    if (u.ok && title.trim()) out.push({ id, title: title.trim(), url: u.value });
  }
  return out;
}

// Shop addresses live at halvo.io/<handle>, so a handle can't be a word the
// site already uses for its own pages — or one it's likely to want later.
export const RESERVED_HANDLES = new Set([
  // pages that exist today
  "access", "api", "auth", "billing", "blog", "checkout", "contact", "dashboard", "discover", "faq",
  "features", "for", "go", "guides", "img", "learn", "login", "pricing", "privacy", "refund-policy",
  "signup", "sitemap", "success", "terms", "unsubscribe",
  // likely to exist one day, or easily mistaken for Halvo itself
  "about", "account", "admin", "affiliates", "app", "assets", "blog", "buy", "careers", "cart",
  "categories", "category", "changelog", "community", "compare", "cookies", "creators", "developers",
  "docs", "download", "downloads", "embed", "explore", "favicon", "feed", "halvo", "help", "home",
  "jobs", "legal", "login", "logout", "marketplace", "media", "news", "official", "partners", "pay",
  "payment", "payments", "press", "profile", "public", "register", "report", "robots", "roadmap",
  "rss", "search", "security", "sellers", "settings", "shop", "signin", "sign-in", "sign-up", "static",
  "status", "store", "support", "team", "tools", "user", "users", "webhook", "webhooks", "www",
]);

export const isReservedHandle = (handle: string) => RESERVED_HANDLES.has(handle.trim().toLowerCase());

// Link previews, crawlers and scripts aren't people tapping a link.
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|curl|wget|python|headless|lighthouse/i.test(
    userAgent,
  );
}
