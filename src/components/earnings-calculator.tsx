import { useState } from "react";
import { PLAN_LABELS, calcPlatformFeeCents, type PlanTier } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIERS: PlanTier[] = ["free", "creator", "pro"];

// Uses the real fee model (plans.ts) so what it shows is exactly what a seller
// receives. Because Halvo uses a Stripe destination charge, the payout is
// price − platform fee — Stripe's own processing fee is absorbed by us, so
// there's no second deduction. That's a genuine selling point, stated honestly.
export function EarningsCalculator() {
  const [price, setPrice] = useState("20");
  const cents = Math.max(0, Math.round(Number(price) * 100) || 0);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
      <Label htmlFor="calc-price" className="text-sm font-medium">
        If you sell a product for…
      </Label>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-muted-foreground">$</span>
        <Input
          id="calc-price"
          type="number"
          min="0"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="max-w-28"
        />
        <span className="text-sm text-muted-foreground">…here's what you keep:</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {TIERS.map((tier) => {
          const fee = calcPlatformFeeCents(tier, cents);
          const keep = Math.max(0, cents - fee);
          const pct = cents > 0 ? Math.round((keep / cents) * 100) : 0;
          return (
            <div
              key={tier}
              className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5"
            >
              <span className="text-sm font-medium">{PLAN_LABELS[tier]}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-primary">
                  ${(keep / 100).toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">you keep{cents > 0 ? ` · ${pct}%` : ""}</span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        That's what actually reaches your own Stripe — Stripe's card fee is on us, so there's no second deduction.
      </p>
    </div>
  );
}
