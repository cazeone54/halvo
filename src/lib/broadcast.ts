// Pure logic for seller -> buyer email broadcasts: who receives one, how often
// a seller may send, what the email looks like, and the signed unsubscribe
// token. No I/O here, so all of it is unit-tested directly.

export const BROADCAST_LIMITS = {
  maxPerWindow: 2,
  windowMs: 24 * 60 * 60 * 1000,
  maxRecipients: 2000,
  subjectMax: 150,
  bodyMax: 10000,
} as const;

export type BroadcastTxnRow = {
  buyer_email: string;
  status: string;
  refunded_at: string | null;
  disputed_at: string | null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Buyers with at least one completed, non-refunded, non-disputed purchase,
// deduplicated, minus anyone who unsubscribed and the placeholder addresses
// the webhook fallback path writes. A buyer who refunded one product but kept
// another still qualifies through the one they kept.
export function selectBroadcastRecipients(rows: readonly BroadcastTxnRow[], unsubscribed: Iterable<string>): string[] {
  const blocked = new Set(Array.from(unsubscribed, normalizeEmail));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (row.status !== "success" || row.refunded_at || row.disputed_at) continue;
    const email = normalizeEmail(row.buyer_email ?? "");
    if (!email.includes("@") || email.endsWith("@buyer.reconciled")) continue;
    if (blocked.has(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

// Rolling-window send limit. `sentAt` = ISO timestamps of this seller's past
// broadcasts (any order). Returns how many sends remain and, when none do,
// when the next one frees up.
export function broadcastQuota(
  sentAt: readonly string[],
  now: number,
  limits: { maxPerWindow: number; windowMs: number } = BROADCAST_LIMITS,
): { remaining: number; nextAvailableAt: string | null } {
  const inWindow = sentAt
    .map((s) => Date.parse(s))
    .filter((t) => Number.isFinite(t) && now - t < limits.windowMs)
    .sort((a, b) => a - b);
  const remaining = Math.max(0, limits.maxPerWindow - inWindow.length);
  if (remaining > 0) return { remaining, nextAvailableAt: null };
  // The slot frees when enough of the oldest sends age out of the window.
  const freeingSend = inWindow[inWindow.length - limits.maxPerWindow];
  return { remaining: 0, nextAvailableAt: new Date(freeingSend + limits.windowMs).toISOString() };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Plain text in, safe HTML out: the seller's words are escaped (never
// rendered as markup), blank lines become paragraphs, single line breaks
// become <br>. Every email carries why the buyer is receiving it and a
// one-click way out.
export function buildBroadcastEmail(params: {
  sellerName: string;
  subject: string;
  body: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const seller = params.sellerName.trim() || "a creator";
  const paragraphs = params.body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const footer = `You're getting this because you bought from ${seller}.`;
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a1c1a;max-width:560px">
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #dfe8e6;margin:24px 0 12px">
    <p style="color:#4e6c67;font-size:12px;margin:0">${escapeHtml(footer)} <a href="${escapeHtml(
      params.unsubscribeUrl,
    )}" style="color:#4e6c67">Unsubscribe</a></p>
  </div>`;
  const text = `${params.body.trim()}\n\n--\n${footer}\nUnsubscribe: ${params.unsubscribeUrl}`;
  return { subject: params.subject.trim(), html, text };
}

// --- Signed unsubscribe token -------------------------------------------------
// token = base64url(JSON {s: sellerId, e: email}) + "." + base64url(HMAC-SHA256)
// Web Crypto only, so it runs identically in Node and in tests.

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signUnsubscribeToken(sellerId: string, email: string, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ s: sellerId, e: normalizeEmail(email) })));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<{ sellerId: string; email: string } | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!constantTimeEqual(await hmac(secret, payload), signature)) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { s?: unknown }).s === "string" &&
      typeof (parsed as { e?: unknown }).e === "string"
    ) {
      return { sellerId: (parsed as { s: string }).s, email: (parsed as { e: string }).e };
    }
    return null;
  } catch {
    return null;
  }
}
