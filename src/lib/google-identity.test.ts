import { describe, expect, it } from "vitest";
import { createNoncePair, toHex } from "./google-identity";

describe("toHex", () => {
  it("encodes bytes as lowercase hex, two chars each", () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff");
  });

  it("pads single digits, so the length is always even", () => {
    expect(toHex(new Uint8Array([1, 2, 3]))).toBe("010203");
  });

  it("handles an empty array", () => {
    expect(toHex(new Uint8Array([]))).toBe("");
  });
});

describe("createNoncePair", () => {
  it("returns a raw nonce and its SHA-256, both hex", () => {
    return createNoncePair().then((pair) => {
      expect(pair.raw).toMatch(/^[0-9a-f]{64}$/);
      expect(pair.hashed).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("never returns the same value for both halves", async () => {
    // Sending the hash to both Google and Supabase, or the raw value to both,
    // would defeat the replay protection entirely.
    const pair = await createNoncePair();
    expect(pair.hashed).not.toBe(pair.raw);
  });

  it("hashes the raw value, so Supabase's check can succeed", async () => {
    const pair = await createNoncePair();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair.raw));
    expect(toHex(new Uint8Array(digest))).toBe(pair.hashed);
  });

  it("is random per call", async () => {
    const [a, b] = await Promise.all([createNoncePair(), createNoncePair()]);
    expect(a.raw).not.toBe(b.raw);
  });
});
