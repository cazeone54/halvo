import { useState, type KeyboardEvent } from "react";
import type { BucketUnit } from "@/lib/analytics-math";

export type ChartBar = {
  key: string;
  start: string;
  unit: BucketUnit;
  value: number | null; // null = nothing to show for this bar (e.g. conversion with no views)
  detail: string; // the other measures for the same bar, shown under the value
};

// One measure over time as bars. One series, so no legend: the card title
// names it. Bars carry the only colour (brand teal); every label is ink. Axes
// are recessive. Pointing at a bar, tapping it, or arrowing through the chart
// with the keyboard shows that bar's value with the other measures beneath;
// a hidden table carries every value for screen readers.
// A bar per day for 7 and 30 days, per week for 90, per month for all time.
export function MetricChart({
  bars,
  format,
  axisFormat = format,
  whole = false,
  label,
  caption,
  empty,
}: {
  bars: ChartBar[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  whole?: boolean; // counts: keep the middle gridline on a whole number
  label: string;
  caption?: string;
  empty: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(0, ...bars.map((b) => b.value ?? 0));
  if (peak === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  const top = niceCeil(peak, whole);
  const unit = bars[0].unit;
  // Buckets are UTC dates, so they're shown in UTC too: a sale on the 27th
  // never shows up under "Oct 26" for a seller west of London.
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(
      "en-US",
      unit === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" },
    );
  const when = (iso: string) => (unit === "week" ? `Week of ${fmt(iso)}` : fmt(iso));
  const lastLabel = unit === "day" ? "Today" : unit === "week" ? "This week" : "This month";

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const from = active ?? bars.length - 1;
    setActive(Math.min(bars.length - 1, Math.max(0, from + (e.key === "ArrowRight" ? 1 : -1))));
  };

  return (
    <figure className="m-0">
      {caption ? <p className="mb-2 text-xs font-medium text-muted-foreground">{caption}</p> : null}
      <div className="flex gap-2">
        <div
          aria-hidden
          className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right text-[11px] tabular-nums text-muted-foreground"
        >
          <span>{axisFormat(top)}</span>
          <span>{axisFormat(top / 2)}</span>
          <span>{axisFormat(0)}</span>
        </div>

        <div
          className="relative min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
          tabIndex={0}
          role="group"
          aria-label={`${label} chart. Use the left and right arrow keys to read each bar.`}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? bars.length - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
        >
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-border/60" />
            <div className="border-t border-border/60" />
            <div className="border-t border-border" />
          </div>

          <div className="relative flex h-36 items-end gap-[2px] sm:h-44">
            {bars.map((b, i) => {
              const on = active === i;
              // Keep the readout inside the card at either end of the chart.
              const place = i < bars.length * 0.2 ? "left-0" : i > bars.length * 0.8 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div
                  key={b.key}
                  className="relative flex h-full flex-1 cursor-default items-end"
                  onPointerEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  {b.value != null && b.value > 0 ? (
                    <div
                      className={`w-full rounded-t-[4px] transition-colors ${on ? "bg-primary/70" : "bg-primary"}`}
                      style={{ height: `${Math.max(2, (b.value / top) * 100)}%` }}
                    />
                  ) : null}
                  {on ? (
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md ${place}`}
                    >
                      <p className="font-semibold">{b.value == null ? "—" : format(b.value)}</p>
                      <p className="text-muted-foreground">{when(b.start)}</p>
                      {b.detail ? <p className="text-muted-foreground">{b.detail}</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption aria-hidden className="mt-2 flex justify-between pl-16 text-[11px] text-muted-foreground">
        <span>{when(bars[0].start)}</span>
        <span>{lastLabel}</span>
      </figcaption>

      <p className="sr-only" aria-live="polite">
        {active != null && bars[active]
          ? `${when(bars[active].start)}: ${bars[active].value == null ? "nothing" : format(bars[active].value!)}. ${bars[active].detail}`
          : ""}
      </p>

      {/* In a hidden box: a table won't shrink to sr-only's 1px by itself, and
          left alone it widened a phone page past the screen. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{unit === "month" ? "Month" : unit === "week" ? "Week" : "Day"}</th>
              <th scope="col">{label}</th>
              <th scope="col">Also</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.key}>
                <th scope="row">{when(b.start)}</th>
                <td>{b.value == null ? "—" : format(b.value)}</td>
                <td>{b.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// Rounds up to 1–2 significant figures so the top gridline is a clean value
// (e.g. 4,730 → 5,000) rather than the exact peak. For counts the top is kept
// even, so the middle gridline is a whole number too (3 → 4, not 5 with 2.5).
function niceCeil(value: number, whole: boolean): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const top = step * magnitude;
  if (!whole || top % 2 === 0) return top;
  return Math.max(2, Math.ceil(value / 2) * 2);
}
