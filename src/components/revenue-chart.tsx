import { formatCents } from "@/lib/format";
import { CURRENCY_META, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { revenueBuckets, type Period } from "@/lib/analytics-math";

// A single-series revenue-over-time bar chart. One series, so no legend — the
// card title names it. Bars carry the only colour (brand teal); every label is
// ink, never the series colour. Axes are recessive; each bar has a hover
// tooltip. Uses design tokens throughout, so it's correct in light and dark by
// construction rather than by an eyeballed flip.
// One currency per chart: a seller paid in both euros and dollars gets one each
// (labelled), since the two can't honestly share an axis.
// A bar per day for 7 and 30 days, per week for 90, per month for all time.
export function RevenueChart({
  data,
  period = 30,
  currency = DEFAULT_CURRENCY,
  labelled = false,
}: {
  data: Array<{ day: string; revenueCents: number }>;
  period?: Period;
  currency?: Currency;
  labelled?: boolean;
}) {
  const money = (cents: number) => formatCents(cents, currency);
  const series = revenueBuckets(data, period, new Date());

  const peak = Math.max(...series.map((s) => s.cents), 0);
  if (peak === 0) {
    return <p className="text-sm text-muted-foreground">No sales in this period.</p>;
  }

  // Round the axis top up to a clean number so the gridline label reads nicely.
  const niceMax = niceCeil(peak);
  const unit = series[0].unit;
  // Buckets are UTC dates, so they're shown in UTC too: a sale on the 27th
  // never shows up under "Oct 26" for a seller west of London.
  const fmt = (d: Date) =>
    d.toLocaleDateString(
      undefined,
      unit === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" },
    );
  const fmtBucket = (d: Date) => (unit === "week" ? `Week of ${fmt(d)}` : fmt(d));
  const lastLabel = unit === "day" ? "Today" : unit === "week" ? "This week" : "This month";

  return (
    <figure className="m-0">
      {labelled ? (
        <p className="mb-2 text-xs font-medium text-muted-foreground">In {CURRENCY_META[currency].name}</p>
      ) : null}
      <div className="flex gap-2">
        {/* y-axis labels */}
        <div className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
          <span>{money(niceMax)}</span>
          <span>{money(niceMax / 2)}</span>
          <span>{CURRENCY_META[currency].symbol}0</span>
        </div>

        {/* plot */}
        <div className="relative min-w-0 flex-1">
          {/* recessive gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-border/60" />
            <div className="border-t border-border/60" />
            <div className="border-t border-border" />
          </div>

          <div className="relative flex h-32 items-end gap-[2px]">
            {series.map((s) => (
              <div key={s.key} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[3px] bg-primary transition-[height] hover:bg-primary/80"
                  style={{ height: `${Math.max(s.cents === 0 ? 0 : 2, (s.cents / niceMax) * 100)}%` }}
                />
                {/* hover tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                  <span className="font-medium">{money(s.cents)}</span>
                  <span className="ml-1 text-muted-foreground">{fmtBucket(s.start)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* x-axis endpoints */}
      <figcaption className="mt-2 flex justify-between pl-14 text-[10px] text-muted-foreground">
        <span>{fmtBucket(series[0].start)}</span>
        <span>{lastLabel}</span>
      </figcaption>
    </figure>
  );
}

// Rounds up to 1–2 significant figures so the top gridline is a clean value
// (e.g. 4,730 → 5,000) rather than the exact peak.
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
