import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Zap, Wallet } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PricingTiers } from "@/components/pricing-tiers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { findAudience } from "@/content/audiences";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/for/$slug")({
  loader: ({ params }) => {
    const audience = findAudience(params.slug);
    if (!audience) throw notFound();
    return audience;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const title = `${loaderData.headline} — ${BRAND_NAME}`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.intro },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.intro },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${BASE_URL}/for/${loaderData.slug}` },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: loaderData.intro },
      ],
    };
  },
  component: AudiencePage,
});

function AudiencePage() {
  const audience = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-hero-glow">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-8rem] h-72 w-[40rem] max-w-[120vw] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          </div>
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6 sm:py-24">
            <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              For {audience.noun}
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-5xl">
              {audience.headline}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">{audience.intro}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/guides">See how it works</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="font-[family-name:var(--font-display)] font-semibold">
                  What {audience.noun} sell here
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {audience.sells.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h2 className="font-[family-name:var(--font-display)] font-semibold">What it replaces</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {audience.painPoints.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground">
                      · {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-5 text-sm">
            <p className="font-medium">Getting started</p>
            <p className="mt-1 text-muted-foreground">{audience.proofPoint}</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex gap-4 p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] font-semibold">Instant delivery</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Buyers get the file the moment payment clears — no manual sending.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex gap-4 p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] font-semibold">Your own Stripe</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payouts land in your account, not ours. We never hold your money.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
              Simple pricing
            </h2>
            <div className="mt-10">
              <PricingTiers />
            </div>
          </div>
        </section>

        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to sell to your audience?
            </h2>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to="/login">
                Start free
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
