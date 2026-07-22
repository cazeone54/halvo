import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS, PLAN_LABELS, PLAN_PRICE_USD, type PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const TIERS: PlanTier[] = ["free", "creator", "pro"];

function formatFee(pct: number): string {
  return pct === 0 ? "0% platform fee" : `${Math.round(pct * 100)}% platform fee`;
}

function formatLimit(n: number): string {
  return n === Number.POSITIVE_INFINITY ? "Unlimited" : String(n);
}

function formatMb(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1 bg-hero-glow">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">Pricing</h1>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you outgrow it.</p>

          <div className="mt-10 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
            {TIERS.map((tier) => {
              const limits = PLAN_LIMITS[tier];
              const price = tier === "free" ? 0 : PLAN_PRICE_USD[tier];
              const isFeatured = tier === "creator";
              const rows = [
                formatFee(limits.platformFeePct),
                `${formatLimit(limits.productsMax)} products`,
                `${limits.filesPerProduct} file${limits.filesPerProduct === 1 ? "" : "s"} per product`,
                `${formatMb(limits.totalStorageMb)} storage`,
                `${limits.aiGenerationsPerMonth} AI generations/mo`,
              ];
              return (
                <Card
                  key={tier}
                  className={
                    isFeatured
                      ? "relative border-primary shadow-lg shadow-primary/10"
                      : "relative"
                  }
                >
                  {isFeatured ? (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
                  ) : null}
                  <CardHeader>
                    <CardTitle className="font-[family-name:var(--font-display)]">{PLAN_LABELS[tier]}</CardTitle>
                    <p className="text-3xl font-semibold tracking-tight">
                      ${price}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <ul className="flex flex-col gap-2 text-sm">
                      {rows.map((row) => (
                        <li key={row} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                          {row}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-2" variant={isFeatured ? "default" : "outline"}>
                      <Link to="/login">Get started</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
