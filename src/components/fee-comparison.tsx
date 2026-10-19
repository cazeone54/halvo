import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/format";
import { UNIVERSAL_FEE_FIXED_CENTS, UNIVERSAL_FEE_PCT } from "@/lib/plans";
import { CHECKED_ON, SOURCES, comparePlatforms, stanCrossoverSales, type PlatformResult } from "@/lib/platform-fees";
import { cn } from "@/lib/utils";

// The same numbers checkout uses, so this table can't promise a fee we don't charge.
const HALVO_RATE = { pct: UNIVERSAL_FEE_PCT, fixedCents: UNIVERSAL_FEE_FIXED_CENTS };

const usd = (cents: number) => (cents < 0 ? `−${formatCents(-cents, "usd")}` : formatCents(cents, "usd"));

const PRESETS = [
  { label: "$9 × 10 a month", price: 9, sales: 10 },
  { label: "$29 × 5 a month", price: 29, sales: 5 },
  { label: "$49 × 30 a month", price: 49, sales: 30 },
];

function label(r: PlatformResult) {
  return r.plan ? `${r.name} · ${r.plan}` : r.name;
}

export function FeeComparison({
  initialPrice = 29,
  initialSales = 5,
  onChange,
}: {
  initialPrice?: number;
  initialSales?: number;
  onChange?: (price: number, sales: number) => void;
}) {
  const [price, setPrice] = useState(String(initialPrice));
  const [sales, setSales] = useState(String(initialSales));

  const priceCents = Math.max(0, Math.round((Number(price) || 0) * 100));
  const salesN = Math.max(0, Math.floor(Number(sales) || 0));
  const revenue = priceCents * salesN;

  // Report edits, not the initial values — otherwise opening the page rewrites
  // its own URL before anyone has touched anything.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) {
      touched.current = true;
      return;
    }
    onChange?.(priceCents / 100, salesN);
  }, [priceCents, salesN, onChange]);

  const rows = useMemo(() => comparePlatforms(priceCents, salesN, HALVO_RATE), [priceCents, salesN]);
  const halvo = rows.find((r) => r.id === "halvo")!;
  const gumroad = rows.find((r) => r.id === "gumroad")!;
  const winner = rows[0];
  const crossover = stanCrossoverSales(priceCents, HALVO_RATE);
  const vsGumroad = halvo.monthlyKeepCents - gumroad.monthlyKeepCents;

  return (
    <div className="rounded-2xl border bg-card p-5 text-left shadow-sm sm:p-7">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fee-price" className="text-sm font-medium">
            Price of one product
          </Label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              id="fee-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="fee-sales" className="text-sm font-medium">
            Sales in a month
          </Label>
          <Input
            id="fee-sales"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={sales}
            onChange={(e) => setSales(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setPrice(String(p.price));
              setSales(String(p.sales));
            }}
            className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {revenue > 0 ? (
          <>
            On <span className="font-medium text-foreground">{usd(revenue)}</span> of sales a month, here is what
            reaches you after every fee:
          </>
        ) : (
          "Enter a price and a number of sales to see what each platform leaves you."
        )}
      </p>

      <ol className="mt-3 flex flex-col gap-2" aria-label="What you keep each month, most first">
        {rows.map((r) => {
          const isHalvo = r.id === "halvo";
          const share = revenue > 0 ? Math.max(0, r.monthlyKeepCents) / revenue : 0;
          return (
            <li
              key={`${r.id}-${r.plan}`}
              className={cn(
                "rounded-xl border px-4 py-3",
                isHalvo ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "bg-muted/30",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className={cn("text-sm", isHalvo ? "font-semibold" : "font-medium")}>{label(r)}</span>
                <span className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-[family-name:var(--font-display)] text-lg font-bold tabular-nums",
                      r.monthlyKeepCents < 0 ? "text-destructive" : isHalvo ? "text-primary" : "text-foreground",
                    )}
                  >
                    {usd(r.monthlyKeepCents)}
                  </span>
                  <span className="text-xs text-muted-foreground">a month</span>
                </span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", isHalvo ? "bg-primary" : "bg-foreground/30")}
                  style={{ width: `${(share * 100).toFixed(1)}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {usd(r.perSaleFeeCents)} in fees per sale
                  {r.monthlyFeeCents > 0 ? ` + ${usd(r.monthlyFeeCents)}/month` : ""}
                </span>
                <span className="flex items-center gap-1">
                  {r.handlesTax ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Collects sales tax and VAT for you
                    </>
                  ) : (
                    <>
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      You handle your own tax
                    </>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {revenue > 0 ? (
        <div className="mt-6 flex flex-col gap-2 rounded-xl border border-dashed p-4 text-sm">
          <p>
            {winner.id === "halvo" ? (
              <>Halvo leaves you the most at this price and volume.</>
            ) : (
              <>
                <span className="font-medium">{label(winner)}</span> leaves you the most at this price and volume
                {winner.handlesTax ? ", and it handles your tax." : "."}
              </>
            )}
          </p>
          {vsGumroad > 0 ? (
            <p className="text-muted-foreground">
              Against Gumroad's direct sales, Halvo leaves you {usd(vsGumroad)} more a month — {usd(vsGumroad * 12)} a
              year.
            </p>
          ) : null}
          {crossover != null ? (
            <p className="text-muted-foreground">
              Stan Store's flat $29 a month costs less than Halvo once you pass {crossover} sales a month at this
              price{priceCents > 0 ? ` (about ${usd(crossover * priceCents)} in sales)` : ""}.
            </p>
          ) : null}
          <p className="text-muted-foreground">
            Halvo doesn't collect sales tax or VAT for you. Lemon Squeezy, Payhip and Gumroad do, and for some sellers
            that is worth more than the difference in fees.
          </p>
        </div>
      ) : null}

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        A US seller and a US buyer paying by card, in US dollars. Card processing at Stripe's standard US rate (2.9% +
        30¢) is included wherever a platform charges it on top. International cards cost extra on every platform.
        Payhip shows whichever of its plans is cheapest for your numbers. Rates checked on {CHECKED_ON} against each
        platform's own pages:{" "}
        {(Object.entries(SOURCES) as [string, string][])
          .filter(([id]) => id !== "gumroad-discover")
          .map(([id, url], i, all) => (
            <span key={id}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                {id === "lemon-squeezy" ? "Lemon Squeezy" : id === "stan" ? "Stan Store" : id[0].toUpperCase() + id.slice(1)}
              </a>
              {i < all.length - 1 ? ", " : "."}
            </span>
          ))}
      </p>
    </div>
  );
}
