// Conversion rate = sales ÷ page views. Pure and tested because it's the number
// a seller reads to decide whether to fix their traffic or their page, and the
// zero-and-overflow edges are exactly where a naive version misleads.

// Returns a percentage 0–100, or null when we can't compute one honestly.
export function conversionRatePct(sales: number, views: number): number | null {
  if (!Number.isFinite(views) || !Number.isFinite(sales)) return null;
  // No views recorded → we genuinely don't know the rate. Not "0%".
  if (views <= 0) return null;
  const pct = (sales / views) * 100;
  if (pct < 0) return 0;
  // Sales can outpace recorded views — a buyer who checks out through the embed
  // overlay, or one whose view landed in an earlier session we de-duplicated.
  // Cap the display at 100% rather than showing a nonsensical 140%.
  return Math.min(pct, 100);
}

// Display form. "—" when there's no view data yet, so a brand-new product
// doesn't read as a 0%-converting failure.
export function formatConversionRate(sales: number, views: number): string {
  const pct = conversionRatePct(sales, views);
  if (pct === null) return "—";
  // One decimal below 10% (2.4%), none above (23%) — precision where it matters.
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}
