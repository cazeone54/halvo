// A short-lived ticket letting a seller fetch one of their own files through
// this site instead of straight from storage.
//
// A seller's session lives in the browser and is sent as a header by the
// server functions — a plain link or an <img> can't carry it. So the server
// signs a ticket naming the file, its owner and an expiry, and the download
// route trusts that rather than a session. Same shape as the unsubscribe and
// billing links already in use: payload, a dot, HMAC-SHA256, Web Crypto only
// so it behaves identically in Node and in tests.
//
// token = base64url(JSON {f: fileId, o: ownerId, x: expiryMs}) "." base64url(mac)

const encoder = new TextEncoder();

// Long enough to click, short enough that a copied link is useless by the time
// it reaches anyone else.
export const FILE_TOKEN_TTL_MS = 5 * 60 * 1000;

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
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`file:${data}`))));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signFileToken(
  fileId: string,
  ownerId: string,
  secret: string,
  now = Date.now(),
  ttlMs = FILE_TOKEN_TTL_MS,
): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ f: fileId, o: ownerId, x: now + ttlMs })));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyFileToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<{ fileId: string; ownerId: string } | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!constantTimeEqual(await hmac(secret, payload), signature)) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { f?: unknown }).f !== "string" ||
      typeof (parsed as { o?: unknown }).o !== "string" ||
      typeof (parsed as { x?: unknown }).x !== "number"
    ) {
      return null;
    }
    const { f, o, x } = parsed as { f: string; o: string; x: number };
    if (now > x) return null;
    return { fileId: f, ownerId: o };
  } catch {
    return null;
  }
}
