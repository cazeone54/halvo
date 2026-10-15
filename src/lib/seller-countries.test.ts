import { describe, it, expect } from "vitest";
import { SELLER_COUNTRIES, guessSellerCountry, isSellerCountry } from "./seller-countries";

describe("SELLER_COUNTRIES", () => {
  it("covers the main English-speaking markets and Europe", () => {
    for (const code of ["US", "GB", "CA", "AU", "IE", "DE", "BG"]) expect(isSellerCountry(code)).toBe(true);
  });

  it("leaves out India, which Stripe refuses for this platform", () => {
    expect(isSellerCountry("IN")).toBe(false);
  });

  it("has no duplicates and is sorted by name for the picker", () => {
    const codes = SELLER_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    const names = SELLER_COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});

describe("guessSellerCountry", () => {
  it("uses the region when the browser gives one", () => {
    expect(guessSellerCountry("en-US")).toBe("US");
    expect(guessSellerCountry("en-GB")).toBe("GB");
    expect(guessSellerCountry("de-AT")).toBe("AT");
  });

  it("falls back to a language that points to one country", () => {
    expect(guessSellerCountry("bg")).toBe("BG");
    expect(guessSellerCountry("pl")).toBe("PL");
  });

  it("doesn't guess from languages spoken in many countries", () => {
    expect(guessSellerCountry("en")).toBe("");
    expect(guessSellerCountry("es")).toBe("");
  });

  it("ignores regions not on the list and empty input", () => {
    expect(guessSellerCountry("hi-IN")).toBe("");
    expect(guessSellerCountry(undefined)).toBe("");
    expect(guessSellerCountry("")).toBe("");
  });
});
