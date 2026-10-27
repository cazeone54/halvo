// The arithmetic behind the Analytics page. Pure, so every number a seller
// reads there is tested rather than assumed.

export type Period = 7 | 30 | 90 | 0; // 0 = all time
export const PERIODS: readonly Period[] = [7, 30, 90, 0];
export const isPeriod = (v: unknown): v is Period => PERIODS.includes(v as Period);
export const periodLabel = (p: Period) => (p === 0 ? "All time" : `${p} days`);

const DAY = 24 * 60 * 60 * 1000;

// The chosen period, and the one just before it for "compared with". All time
// has nothing before it to compare with.
export function periodWindow(period: Period, now: Date): { since: Date | null; prevSince: Date | null } {
  if (period === 0) return { since: null, prevSince: null };
  return { since: new Date(now.getTime() - period * DAY), prevSince: new Date(now.getTime() - 2 * period * DAY) };
}

// Percentage change, or null when there's nothing to compare with — "up ∞%"
// from zero says nothing, and neither does a change against no history.
export function pctChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return ((current - previous) / previous) * 100;
}

// Stored sources are raw: "instagram.com", "l.instagram.com", "ig", a utm tag.
// One label per place, so Instagram isn't split across three slices.
const SOURCE_NAMES: Array<[RegExp, string]> = [
  [/^(instagram(\.com)?|ig|l\.instagram\.com)$/, "Instagram"],
  [/^(tiktok(\.com)?|tt|vm\.tiktok\.com)$/, "TikTok"],
  [/^(facebook(\.com)?|fb|meta|m\.facebook\.com|l\.facebook\.com)$/, "Facebook"],
  [/^(youtube(\.com)?|yt|youtu\.be|m\.youtube\.com)$/, "YouTube"],
  [/^(x\.com|x|twitter(\.com)?|t\.co)$/, "X"],
  [/^(google|google\.[a-z.]+|bing\.com|duckduckgo\.com|search)$/, "Search engines"],
  [/^(gmail|email|e-?mail|newsletter|mail|outlook\.live\.com)$/, "Email"],
  [/^(pinterest(\.com)?|pin\.it)$/, "Pinterest"],
  [/^(linkedin(\.com)?|lnkd\.in)$/, "LinkedIn"],
  [/^(reddit(\.com)?)$/, "Reddit"],
  [/^direct$/, "Direct"],
];

export function sourceLabel(raw: string | null | undefined): string {
  const s = raw?.trim().toLowerCase();
  if (!s) return "Unknown";
  for (const [re, name] of SOURCE_NAMES) if (re.test(s)) return name;
  return s.replace(/^www\./, "");
}

// The keys that get their own colour: the biggest few over ALL time, so a
// colour stays with the same source or product when the period changes. (A
// colour that followed the current ranking would repaint "Instagram" orange
// one week and blue the next.)
export function stableTopKeys(totals: Map<string, number>, max = 4): string[] {
  return [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([k]) => k);
}

export type Slice = { key: string; value: number; share: number; slot: number }; // slot 0 = Other

// A circle chart's data, or the reason there isn't one yet. Each slice carries
// its own label and formatted value, so the legend is also the table view.
export type DonutData = {
  ready: boolean;
  have: number; // what there is so far
  need: number; // what it takes before the split means something
  totalLabel: string;
  slices: Array<{ key: string; label: string; valueLabel: string; share: number; slot: number }>;
};

// "34%", or "<1%" for a sliver, so a real slice never reads as 0%.
export const shareLabel = (share: number) => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);

// Part-to-whole for a circle chart: the stable keys in their stable order and
// colours, everything else folded into one "Other". Empty slices are dropped.
export function toSlices(values: Map<string, number>, stableKeys: string[]): { slices: Slice[]; total: number } {
  const total = [...values.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return { slices: [], total: 0 };
  const slices: Slice[] = [];
  stableKeys.forEach((key, i) => {
    const v = values.get(key) ?? 0;
    if (v > 0) slices.push({ key, value: v, share: v / total, slot: i + 1 });
  });
  const other = total - slices.reduce((a, s) => a + s.value, 0);
  if (other > 0) slices.push({ key: "Other", value: other, share: other / total, slot: 0 });
  return { slices, total };
}

// Revenue bars for the chosen period: a bar per day for 7 and 30 days, per
// week for 90 (ninety bars would be hairlines on a phone), per month for all
// time (the last twelve). Keys are UTC dates, matching how sales are bucketed.
export function revenueBuckets(
  days: ReadonlyArray<{ day: string; revenueCents: number }>,
  period: Period,
  now: Date,
): Array<{ key: string; start: Date; cents: number; unit: "day" | "week" | "month" }> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const byDay = new Map(days.map((d) => [d.day, d.revenueCents]));
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  if (period === 7 || period === 30) {
    return Array.from({ length: period }, (_, i) => {
      const d = new Date(today.getTime() - (period - 1 - i) * DAY);
      return { key: dayKey(d), start: d, cents: byDay.get(dayKey(d)) ?? 0, unit: "day" as const };
    });
  }
  if (period === 90) {
    const weeks = 13; // 91 days, ending today
    return Array.from({ length: weeks }, (_, w) => {
      const start = new Date(today.getTime() - (weeks * 7 - 1 - w * 7) * DAY);
      let cents = 0;
      for (let k = 0; k < 7; k++) cents += byDay.get(dayKey(new Date(start.getTime() + k * DAY))) ?? 0;
      return { key: dayKey(start), start, cents, unit: "week" as const };
    });
  }
  const byMonth = new Map<string, number>();
  for (const d of days) byMonth.set(d.day.slice(0, 7), (byMonth.get(d.day.slice(0, 7)) ?? 0) + d.revenueCents);
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - i), 1));
    const key = start.toISOString().slice(0, 7);
    return { key, start, cents: byMonth.get(key) ?? 0, unit: "month" as const };
  });
}
