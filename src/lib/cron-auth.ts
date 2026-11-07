// Checks a scheduler's `Authorization: Bearer <CRON_SECRET>` header. A plain
// `===` stops at the first wrong character, so how long it takes can tell
// someone how much of a guess was right. Both sides are hashed first (always
// the same length) and every byte is compared, so the time never varies.
// Without a secret set, nothing is authorized.
export async function isCronAuthorized(authorization: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const encoder = new TextEncoder();
  const [given, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(authorization ?? "")),
    crypto.subtle.digest("SHA-256", encoder.encode(`Bearer ${secret}`)),
  ]);
  const a = new Uint8Array(given);
  const b = new Uint8Array(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
