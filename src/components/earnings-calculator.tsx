import { formatCents } from "@/lib/format";
import { useState } from "react";
import { ACTIVE_TIERS, DIRECT_CHARGES, PLAN_LABELS, calcPlatformFeeCents, type PlanTier } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Only the tiers actually on sale — otherwise single-tier pricing renders the
// same number three times, which reads like a bug.
const TIERS: PlanTier[] = ACTIVE_TIERS;

// Uses the real fee model (plans.ts), and has to track which Stripe charge type
// is live or it misstates a seller's income.
//
// Under DESTINATION charges the money passes through the platform, which pays
// Stripe's processing fee out of its own cut — so price − platform fee really
// is what lands, and there is no second deduction.
//
// Under DIRECT charges the payment is created on the seller's connected
// account: Stripe bills its card fee straight to them. The figure below is
// then what's left after Halvo's fee only, NOT the final payout, and claiming
// otherwise overstates what a seller earns on every single sale. The same
// branch is in features.tsx and faq.tsx — this file was the one left behind
// when charges moved.
const FEE_ALL_IN = !DIRECT_CHARGES;
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
        <span className="text-sm text-muted-foreground">
          {FEE_ALL_IN ? "…here's what you keep:" : "…here's what's left after our fee:"}
        </span>
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
              {/* The plan name only means something when there's a choice; on
                  its own "Free" reads as if the product were free. */}
              <span className="text-sm font-medium">
                {TIERS.length === 1 ? (FEE_ALL_IN ? "Your payout" : "After our fee") : PLAN_LABELS[tier]}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-primary">
                  {formatCents(keep)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {FEE_ALL_IN ? "you keep" : "of the sale"}
                  {cents > 0 ? ` · ${pct}%` : ""}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {FEE_ALL_IN
          ? "That's what actually reaches your own Stripe — Stripe's card fee is on us, so there's no second deduction."
          : "Stripe charges its own card fee to your Stripe account on top of this, the same as it would on your own site. It depends on the buyer's card, and you'll see it on every payment in your Stripe dashboard."}
      </p>
    </div>
  );
}
