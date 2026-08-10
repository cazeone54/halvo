import { createFileRoute } from "@tanstack/react-router";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PricingTiers } from "@/components/pricing-tiers";
import { EarningsCalculator } from "@/components/earnings-calculator";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1 bg-hero-glow">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">Pricing</h1>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you outgrow it.</p>

          <div className="mt-12">
            <PricingTiers />
          </div>

          <div className="mt-16">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">
              See what you'd keep
            </h2>
            <p className="mt-2 text-muted-foreground">Try a price — the math updates live.</p>
            <div className="mt-6">
              <EarningsCalculator />
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
