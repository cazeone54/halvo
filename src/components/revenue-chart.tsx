import { formatCents } from "@/lib/format";

// A single-series revenue-over-time bar chart. One series, so no legend — the
// card title names it. Bars carry the only colour (brand teal); every label is
// ink, never the series colour. Axes are recessive; each bar has a hover
// tooltip. Uses design tokens throughout, so it's correct in light and dark by
// construction rather than by an eyeballed flip.
export function RevenueChart({ data }: { data: Array<{ day: string; revenueCents: number }> }) {
  const DAYS = 30;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const byDay = new Map(data.map((d) => [d.day, d.revenueCents]));
  const series = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, date: d, cents: byDay.get(key) ?? 0 };
  });

  const peak = Math.max(...series.map((s) => s.cents), 0);
  if (peak === 0) {
    return <p className="text-sm text-muted-foreground">No sales in the last 30 days.</p>;
  }

  // Round the axis top up to a clean number so the gridline label reads nicely.
  const niceMax = niceCeil(peak);
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        {/* y-axis labels */}
        <div className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
          <span>{formatCents(niceMax)}</span>
          <span>{formatCents(niceMax / 2)}</span>
          <span>$0</span>
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
                  <span className="font-medium">{formatCents(s.cents)}</span>
                  <span className="ml-1 text-muted-foreground">{fmtDay(s.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* x-axis endpoints */}
      <figcaption className="mt-2 flex justify-between pl-14 text-[10px] text-muted-foreground">
        <span>{fmtDay(series[0].date)}</span>
        <span>Today</span>
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
