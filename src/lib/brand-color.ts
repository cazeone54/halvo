// A seller's brand color, made safe to use everywhere the platform's own
// accent is used — including as TEXT (prices, links). Pure, so the contrast
// guarantees are unit-tested rather than eyeballed.
//
// The seller's color is used as chosen whenever it's legible. A color too
// pale to read on the light surface is deepened just enough to reach 4.5:1
// (WCAG AA body text); a color too dark for the dark theme is lightened just
// enough for the same. Button text is whichever of white/black reads better.

export const BRAND_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Amber", hex: "#d97706" },
  { name: "Emerald", hex: "#059669" },
  { name: "Ocean", hex: "#0284c7" },
  { name: "Graphite", hex: "#334155" },
];

// The surfaces brand-colored text sits on (approximations of the theme's
// --background / --card in styles.css). Light: text is worst on the darker of
// the light surfaces; dark: worst on the lighter of the dark surfaces.
const LIGHT_SURFACE = "#f4f5f8";
const DARK_SURFACE = "#12162b";
const WHITE = "#ffffff";
const BLACK = "#000000";
export const MIN_TEXT_CONTRAST = 4.5;

export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

// Smallest step toward `toward` that reaches the target contrast against `surface`.
function adjustForContrast(hex: string, surface: string, toward: string): string {
  if (contrastRatio(hex, surface) >= MIN_TEXT_CONTRAST) return hex;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const candidate = mix(hex, toward, t);
    if (contrastRatio(candidate, surface) >= MIN_TEXT_CONTRAST) return candidate;
  }
  return toward;
}

function readableOn(hex: string): string {
  return contrastRatio(hex, WHITE) >= contrastRatio(hex, BLACK) ? WHITE : BLACK;
}

export type BrandTheme = { light: string; lightFg: string; dark: string; darkFg: string };

export function brandTheme(hex: string): BrandTheme {
  const light = adjustForContrast(hex, LIGHT_SURFACE, BLACK);
  const dark = adjustForContrast(hex, DARK_SURFACE, WHITE);
  return { light, lightFg: readableOn(light), dark, darkFg: readableOn(dark) };
}

// CSS custom properties for a `.brand-theme` wrapper (see styles.css), or
// undefined to keep the platform's default accent.
export function brandThemeStyle(accent: string | null | undefined): Record<string, string> | undefined {
  const hex = accent ? normalizeHex(accent) : null;
  if (!hex) return undefined;
  const t = brandTheme(hex);
  return {
    "--brand-light": t.light,
    "--brand-light-fg": t.lightFg,
    "--brand-dark": t.dark,
    "--brand-dark-fg": t.darkFg,
  };
}
