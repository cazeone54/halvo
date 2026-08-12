import { describe, it, expect } from "vitest";
import { formatLicenseKey, generateLicenseKey, looksLikeLicenseKey } from "@/lib/license";

describe("formatLicenseKey", () => {
  it("formats as 4 groups of 4", () => {
    expect(formatLicenseKey(new Array(16).fill(0))).toBe("AAAA-AAAA-AAAA-AAAA");
  });

  it("uses only the ambiguity-free alphabet (no 0 O 1 I L)", () => {
    const key = formatLicenseKey(Array.from({ length: 16 }, (_, i) => i));
    expect(key).not.toMatch(/[OIL01]/);
    expect(key).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  });

  it("wraps indices modulo the alphabet length", () => {
    // 31-char alphabet, so index 31 wraps back to 'A'
    expect(formatLicenseKey(new Array(16).fill(31))).toBe("AAAA-AAAA-AAAA-AAAA");
  });
});

describe("generateLicenseKey", () => {
  it("produces the expected shape and distinct values", () => {
    const a = generateLicenseKey();
    const b = generateLicenseKey();
    expect(a).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
    expect(a).not.toBe(b);
  });
});

describe("looksLikeLicenseKey", () => {
  it("accepts a well-formed key and rejects junk", () => {
    expect(looksLikeLicenseKey("AB3K-9XZ2-QW7M-4TYP")).toBe(true);
    expect(looksLikeLicenseKey("ab3k-9xz2-qw7m-4typ")).toBe(true); // case-insensitive
    expect(looksLikeLicenseKey("not-a-key")).toBe(false);
    expect(looksLikeLicenseKey("")).toBe(false);
  });
});
