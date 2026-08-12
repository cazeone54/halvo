// License key generation. The alphabet excludes visually ambiguous characters
// (0/O, 1/I/L) so keys are easy to read, type and dictate. Keys look like
// "AB3K-9XZ2-QW7M-4TYP" — 16 chars from a 31-char alphabet ≈ 79 bits of entropy,
// so collisions are effectively impossible (and the DB unique constraint guards
// the rest).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 4;
const GROUP_LEN = 4;

// Pure: map an array of random integers to a formatted key. Separated from the
// crypto source so the format/charset is unit-testable.
export function formatLicenseKey(randomInts: number[]): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LEN; i++) {
      const n = randomInts[g * GROUP_LEN + i] ?? 0;
      group += ALPHABET[n % ALPHABET.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}

// A cryptographically-random key. crypto.getRandomValues is available in Node
// 20+ and browsers, so this stays isomorphic-safe.
export function generateLicenseKey(): string {
  const bytes = new Uint8Array(GROUPS * GROUP_LEN);
  crypto.getRandomValues(bytes);
  return formatLicenseKey(Array.from(bytes));
}

// Loose shape check for a user-supplied key before hitting the database.
export function looksLikeLicenseKey(value: string): boolean {
  return /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(value.trim().toUpperCase());
}
