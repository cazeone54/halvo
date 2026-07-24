import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Wallet, Percent, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PersonaMarquee } from "@/components/persona-marquee";
import { ExplainerAnimation } from "@/components/explainer-animation";
import { BRAND_NAME } from "@/lib/site";
import { PLAN_LABELS, PLAN_PRICE_USD } from "@/lib/plans";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const FEATURES = [
  {
    icon: Zap,
    title: "Instant checkout",
    body: "Stripe-powered checkout with Apple Pay, Google Pay, and card — buyers get their download the second payment succeeds.",
  },
  {
    icon: Wallet,
    title: "Real payouts",
    body: "Sales route through Stripe Connect as a real destination charge, so your cut lands in your own Stripe balance automatically.",
  },
  {
    icon: Percent,
    title: "Discounts & affiliates",
    body: "Run percent-off or flat discount codes, and let affiliates earn a commission on every sale they refer.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted listings",
    body: "Turn a rough pitch into a polished product name and description in seconds.",
  },
];

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-hero-glow">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
            <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Now in early access
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-gradient sm:text-7xl">
              {BRAND_NAME}
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Sell digital products in minutes. Instant checkout, instant delivery, real payouts.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>

          <div className="pb-16">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Built for creators selling
            </p>
            <PersonaMarquee />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
            See how it works
          </h2>
          <p className="mt-2 text-center text-muted-foreground">30 seconds: list a product, get paid.</p>
          <div className="mt-6">
            <ExplainerAnimation />
          </div>
        </section>

        <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6">
          {FEATURES.map((f) => (
            <Card key={f.title} className="card-hover">
              <CardContent className="flex gap-4 pt-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] font-semibold">{f.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
              Simple pricing
            </h2>
            <p className="mt-2 text-muted-foreground">
              Start free. Upgrade when you outgrow it — {PLAN_LABELS.creator} is ${PLAN_PRICE_USD.creator}/mo,{" "}
              {PLAN_LABELS.pro} is ${PLAN_PRICE_USD.pro}/mo.
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link to="/pricing">
                Compare plans
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
