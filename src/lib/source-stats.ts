// Traffic and sales per channel, combined — so the dashboard can show
// conversion per source rather than two unrelated lists.
//
// Pure, so the ordering and the edge cases (a channel with sales but no
// recorded views, views from before migration 0023) are testable without a
// database.

export const UNKNOWN_SOURCE = "Unknown";

export interface SourceStat {
  source: string;
  views: number;
  sales: number;
}

/**
 * @param viewSources one entry per recorded view; null for views from before
 *                    0023, which are reported as "Unknown" rather than folded
 *                    into "Direct" — overstating direct traffic would make the
 *                    seller trust a number that isn't measured.
 * @param saleSources one entry per recorded sale.
 *
 * Sorted by sales first, then views: sales are what the seller is optimising
 * for, and before the first sale this falls through to traffic volume, which is
 * the only signal available then.
 */
export function mergeSourceStats(
  viewSources: Array<string | null | undefined>,
  saleSources: Array<string | null | undefined>,
): SourceStat[] {
  const stats = new Map<string, SourceStat>();

  const entry = (raw: string | null | undefined): SourceStat => {
    const source = raw?.trim() || UNKNOWN_SOURCE;
    const existing = stats.get(source);
    if (existing) return existing;
    const created = { source, views: 0, sales: 0 };
    stats.set(source, created);
    return created;
  };

  for (const raw of viewSources) entry(raw).views += 1;
  // A sale can exist for a channel with no views on record — the view predates
  // 0023, or the buyer arrived straight at checkout via an embed. It still has
  // to appear, or the sales total on this card won't match the one above it.
  for (const raw of saleSources) entry(raw).sales += 1;

  return Array.from(stats.values()).sort(
    (a, b) => b.sales - a.sales || b.views - a.views || a.source.localeCompare(b.source),
  );
}
