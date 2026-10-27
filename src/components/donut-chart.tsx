import { useState } from "react";
import { shareLabel, type DonutData } from "@/lib/analytics-math";

// Slot 0 is "Other"; 1–4 are the validated circle-chart colours in fixed
// order (see --donut-* in styles.css). A slot belongs to a source or product,
// not to its rank, so a colour never jumps to a different slice.
const SLOT_COLOR = ["var(--donut-other)", "var(--donut-1)", "var(--donut-2)", "var(--donut-3)", "var(--donut-4)"];

const SIZE = 120;
const R = 46;
const STROKE = 16;
const C = 2 * Math.PI * R;
const GAP = 2; // card-coloured gap between slices

// A part-to-whole ring with at most five slices (four named + Other). The
// legend underneath is also the table view: every slice's name, value and
// share as text, so nothing depends on telling colours apart. Hovering a slice
// or a legend row, or tabbing to a row, shows that slice in the middle.
export function DonutChart({ data, title, waiting }: { data: DonutData; title: string; waiting: string }) {
  const [active, setActive] = useState<string | null>(null);

  if (!data.ready || data.slices.length === 0) {
    return <p className="text-sm text-muted-foreground">{waiting}</p>;
  }

  const current = data.slices.find((s) => s.key === active) ?? null;
  const many = data.slices.length > 1;
  let offset = 0;
  const arcs = data.slices.map((s) => {
    const len = s.share * C;
    const dash = many ? Math.max(len - GAP, 0.75) : C;
    const arc = { ...s, dash, start: offset };
    offset += len;
    return arc;
  });

  return (
    <figure className="m-0 flex flex-col items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90" role="img" aria-label={`${title}: ${data.slices.map((s) => `${s.label} ${shareLabel(s.share)}`).join(", ")}`}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={SLOT_COLOR[a.slot]}
              strokeWidth={STROKE}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={-a.start}
              pointerEvents="stroke"
              className="cursor-default transition-opacity"
              style={{ opacity: current && current.key !== a.key ? 0.3 : 1 }}
              onMouseEnter={() => setActive(a.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        {/* px-8 keeps the text inside the round hole, not just the square box
            around it: "€486.50 + $45.00" wraps rather than running under the ring. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center" aria-live="polite">
          {current ? (
            <>
              <span className="font-[family-name:var(--font-display)] text-xl font-bold tabular-nums leading-none">{shareLabel(current.share)}</span>
              <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{current.label}</span>
            </>
          ) : (
            <span className="text-xs font-medium leading-tight tabular-nums">{data.totalLabel}</span>
          )}
        </div>
      </div>

      <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
        {data.slices.map((s) => (
          <li
            key={s.key}
            tabIndex={0}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === s.key ? "bg-muted" : ""}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLOT_COLOR[s.slot] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={s.label}>
              {s.label}
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{s.valueLabel}</span>
            <span className="w-10 shrink-0 text-right font-medium tabular-nums">{shareLabel(s.share)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
