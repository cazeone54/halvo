import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTIVE_TIERS, DIRECT_CHARGES, PLAN_LIMITS, PLAN_LABELS, PLAN_PRICE_USD, type PlanTier } from "@/lib/plans";

// Shared by the landing page and /pricing so the two can never drift apart —
// everything is derived from plans.ts, the single source of truth for limits
// and for which tiers are actually on sale (see SINGLE_TIER_PRICING there).
const TIERS: PlanTier[] = ACTIVE_TIERS;
const SINGLE = TIERS.length === 1;

function formatFee(pct: number, fixedCents: number): string {
  const rate = `${Math.round(pct * 100)}%`;
  return fixedCents === 0 ? `${rate} per sale` : `${rate} + ${fixedCents}¢ per sale`;
}

function formatLimit(n: number): string {
  return n === Number.POSITIVE_INFINITY ? "Unlimited" : String(n);
}

function formatMb(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

export function PricingTiers() {
  return (
    <div
      className={
        SINGLE
          ? "mx-auto grid max-w-sm grid-cols-1 gap-6 text-left"
          : "grid grid-cols-1 gap-6 text-left sm:grid-cols-3"
      }
    >
      {TIERS.map((tier) => {
        const limits = PLAN_LIMITS[tier];
        const price = tier === "free" ? 0 : PLAN_PRICE_USD[tier];
        const isFeatured = SINGLE || tier === "creator";
        const rows = [
          // The fee is already the headline when there's only one plan.
          ...(SINGLE ? [] : [formatFee(limits.platformFeePct, limits.platformFeeFixedCents)]),
          `${formatLimit(limits.productsMax)} products`,
          `${limits.filesPerProduct} file${limits.filesPerProduct === 1 ? "" : "s"} per product`,
          `${formatMb(limits.totalStorageMb)} storage`,
          `${limits.monthlyBandwidthGb} GB downloads/mo`,
          `${limits.aiGenerationsPerMonth} AI generations/mo`,
        ];

        return (
          <Card
            key={tier}
            className={
              isFeatured
                ? "relative border-primary shadow-lg shadow-primary/10 transition-transform duration-200 sm:-translate-y-2"
                : "relative transition-transform duration-200 hover:-translate-y-1"
            }
          >
            {isFeatured && !SINGLE ? (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
            ) : null}
            <CardHeader>
              {/* With one plan there is nothing to compare, so lead with the
                  only number that matters — the per-sale fee — instead of a
                  "$0/mo" that reads as a limited trial. */}
              {SINGLE ? (
                <>
                  <CardTitle className="font-[family-name:var(--font-display)]">No monthly fee</CardTitle>
                  <p className="text-3xl font-semibold tracking-tight">
                    {Math.round(limits.platformFeePct * 100)}%
                    {limits.platformFeeFixedCents > 0 ? ` + ${limits.platformFeeFixedCents}¢` : ""}
                    <span className="text-sm font-normal text-muted-foreground"> per sale</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You pay nothing until you sell something.
                    {/* Under direct charges Stripe bills the seller's own account
                        separately, so say so here rather than let them find it on
                        a statement. */}
                    {DIRECT_CHARGES ? " Stripe's card fee is billed to your own Stripe account on top." : ""}
                  </p>
                </>
              ) : (
                <>
                  <CardTitle className="font-[family-name:var(--font-display)]">{PLAN_LABELS[tier]}</CardTitle>
                  <p className="text-3xl font-semibold tracking-tight">
                    ${price}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2 text-sm">
                {rows.map((row) => (
                  <li key={row} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {row}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-2" variant={isFeatured ? "default" : "outline"}>
                <Link to="/login">
                  {SINGLE ? "Start selling" : tier === "free" ? "Start free" : `Choose ${PLAN_LABELS[tier]}`}
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
