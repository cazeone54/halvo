import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS, PLAN_LABELS, PLAN_PRICE_USD, type PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const TIERS: PlanTier[] = ["free", "creator", "pro"];

function formatFee(pct: number): string {
  return pct === 0 ? "0% fee" : `${Math.round(pct * 100)}% fee`;
}

function formatLimit(n: number): string {
  return n === Number.POSITIVE_INFINITY ? "Unlimited" : String(n);
}

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Pricing</h1>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you outgrow it.</p>

          <div className="mt-10 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
            {TIERS.map((tier) => {
              const limits = PLAN_LIMITS[tier];
              const price = tier === "free" ? 0 : PLAN_PRICE_USD[tier];
              return (
                <Card key={tier} className={tier === "creator" ? "border-primary" : undefined}>
                  <CardHeader>
                    <CardTitle className="font-[family-name:var(--font-display)]">{PLAN_LABELS[tier]}</CardTitle>
                    <p className="text-2xl font-semibold">
                      ${price}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <p>{formatFee(limits.platformFeePct)} on sales</p>
                    <p>{formatLimit(limits.productsMax)} products</p>
                    <p>{limits.filesPerProduct} files per product</p>
                    <p>{limits.totalStorageMb >= 1024 ? `${limits.totalStorageMb / 1024} GB` : `${limits.totalStorageMb} MB`} storage</p>
                    <p>{limits.aiGenerationsPerMonth} AI generations/mo</p>
                    <Button asChild className="mt-4">
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
