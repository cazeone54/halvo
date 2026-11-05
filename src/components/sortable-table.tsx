import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: string;
  numeric?: boolean; // right-aligned, digits lined up
  sortValue?: (row: T) => number | string; // left out = this column doesn't sort
  cell: (row: T) => ReactNode;
  className?: string; // e.g. "hidden sm:table-cell" to drop a column on a phone
  width?: string; // e.g. "w-[24%]"; columns without one share what's left
};

type Sort = { key: string; dir: "asc" | "desc" };

// A plain table whose headers sort it: numbers biggest first on the first
// click, words A–Z, a second click reverses. Long lists show the first
// `limit` rows with a button for the rest. `bar` draws a faint magnitude bar
// behind the first cell, so the biggest rows stand out without a chart.
export function SortableTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  caption,
  limit,
  bar,
}: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  defaultSort: Sort;
  caption: string;
  limit?: number;
  bar?: (row: T) => number; // 0–1
}) {
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [all, setAll] = useState(false);

  const column = columns.find((c) => c.key === sort.key);
  const sorted = column?.sortValue
    ? [...rows].sort((a, b) => {
        const x = column.sortValue!(a);
        const y = column.sortValue!(b);
        const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.dir === "asc" ? order : -order;
      })
    : [...rows];
  const shown = limit && !all ? sorted.slice(0, limit) : sorted;

  const toggle = (c: Column<T>) =>
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.numeric ? "desc" : "asc" }));

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full table-fixed text-[13px] sm:text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            {columns.map((c, i) => {
              const on = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "pb-2 font-medium",
                    i === 0 ? "w-[32%] text-left sm:w-[38%]" : "pl-2 text-right",
                    c.width,
                    c.className,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on && "text-foreground",
                      )}
                    >
                      {c.label}
                      {on ? (
                        sort.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />
                      ) : null}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={rowKey(row)} className="border-t">
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "py-2",
                    "align-top",
                    i === 0 ? "relative pr-3" : "pl-2 text-right tabular-nums whitespace-nowrap",
                    c.className,
                  )}
                >
                  {i === 0 && bar ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1 h-7 rounded-sm bg-primary/10"
                      style={{ width: `${Math.max(0, Math.min(1, bar(row))) * 100}%` }}
                    />
                  ) : null}
                  {i === 0 ? <span className="relative block truncate">{c.cell(row)}</span> : c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="self-start rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </div>
  );
}
