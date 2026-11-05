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

export type BucketUnit = "day" | "week" | "month";
export type Bucket = { key: string; start: string; unit: BucketUnit };

// The bars of the chart for the chosen period: a bar per day for 7 and 30
// days, per week for 90 (ninety bars would be hairlines on a phone), per month
// for all time (the last twelve). UTC dates, matching how activity is bucketed.
export function timeBuckets(period: Period, now: Date): Bucket[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const iso = (t: number) => new Date(t).toISOString();

  if (period === 7 || period === 30) {
    return Array.from({ length: period }, (_, i) => {
      const t = today - (period - 1 - i) * DAY;
      return { key: iso(t).slice(0, 10), start: iso(t), unit: "day" as const };
    });
  }
  if (period === 90) {
    const weeks = 13; // 91 days, ending today
    return Array.from({ length: weeks }, (_, w) => {
      const t = today - (weeks * 7 - 1 - w * 7) * DAY;
      return { key: iso(t).slice(0, 10), start: iso(t), unit: "week" as const };
    });
  }
  return Array.from({ length: 12 }, (_, i) => {
    const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1);
    return { key: iso(t).slice(0, 7), start: iso(t), unit: "month" as const };
  });
}

// Which bar a timestamp belongs to, or -1 when it falls outside the chart.
export function bucketFinder(buckets: readonly Bucket[]): (iso: string) => number {
  const index = new Map<string, number>();
  buckets.forEach((b, i) => {
    if (b.unit === "week") {
      for (let k = 0; k < 7; k++) index.set(new Date(Date.parse(b.start) + k * DAY).toISOString().slice(0, 10), i);
    } else {
      index.set(b.key, i);
    }
  });
  const monthly = buckets[0]?.unit === "month";
  return (iso) => index.get(monthly ? iso.slice(0, 7) : iso.slice(0, 10)) ?? -1;
}
