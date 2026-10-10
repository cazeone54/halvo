import { describe, expect, it } from "vitest";
import {
  BRAND_PRESETS,
  MIN_TEXT_CONTRAST,
  brandTheme,
  brandThemeStyle,
  contrastRatio,
  normalizeHex,
} from "./brand-color";

const LIGHT_SURFACE = "#f4f5f8";
const DARK_SURFACE = "#12162b";

describe("normalizeHex", () => {
  it("accepts 3- and 6-digit hex with or without #, any case", () => {
    expect(normalizeHex("#4F46E5")).toBe("#4f46e5");
    expect(normalizeHex("4f46e5")).toBe("#4f46e5");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("  #ABC ")).toBe("#aabbcc");
  });
  it("rejects anything else, including CSS injection attempts", () => {
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("#fff; background:url(x)")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});

describe("brandTheme", () => {
  it("leaves a legible mid-tone color exactly as the seller chose it", () => {
    expect(brandTheme("#4f46e5").light).toBe("#4f46e5");
  });

  it("deepens a too-pale color for light mode and lightens a too-dark one for dark mode", () => {
    const pale = brandTheme("#fde68a");
    expect(pale.light).not.toBe("#fde68a");
    expect(contrastRatio(pale.light, LIGHT_SURFACE)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);

    const navy = brandTheme("#0b1530");
    expect(navy.dark).not.toBe("#0b1530");
    expect(contrastRatio(navy.dark, DARK_SURFACE)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("keeps brand text legible and button text readable for a wide sweep of colors", () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
          const t = brandTheme(hex);
          expect(contrastRatio(t.light, LIGHT_SURFACE)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
          expect(contrastRatio(t.dark, DARK_SURFACE)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
          expect(contrastRatio(t.light, t.lightFg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
          expect(contrastRatio(t.dark, t.darkFg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
      }
    }
  });

  it("every preset is valid hex", () => {
    for (const p of BRAND_PRESETS) expect(normalizeHex(p.hex)).toBe(p.hex);
  });
});

describe("brandThemeStyle", () => {
  it("returns undefined for no color or an invalid one, so the default theme applies", () => {
    expect(brandThemeStyle(null)).toBeUndefined();
    expect(brandThemeStyle("not-a-color")).toBeUndefined();
  });
  it("returns the four CSS variables for a valid color", () => {
    expect(Object.keys(brandThemeStyle("#e11d48") ?? {})).toEqual([
      "--brand-light",
      "--brand-light-fg",
      "--brand-dark",
      "--brand-dark-fg",
    ]);
  });
});
