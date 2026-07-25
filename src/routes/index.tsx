import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Wallet, Percent, Sparkles, ArrowRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PersonaMarquee } from "@/components/persona-marquee";
import { ExplainerAnimation } from "@/components/explainer-animation";
import { PricingTiers } from "@/components/pricing-tiers";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: BASE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: BRAND_NAME,
          url: BASE_URL,
          description: `${BRAND_NAME} lets creators sell digital products with instant checkout and delivery.`,
          logo: `${BASE_URL}/icon.svg`,
        }),
      },
    ],
  }),
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

// Factual product claims rather than invented usage numbers — these are true
// today and safe to ship. Swap in real traction stats once you have them.
const PROOF_STATS = [
  { value: "~5 min", label: "Signup to first product live" },
  { value: "Instant", label: "Checkout to download" },
  { value: "Your own", label: "Stripe account for payouts" },
  { value: "24/7", label: "Sells while you sleep" },
];

// Deliberately written as unfilled slots, NOT invented reviews — replace each
// with a real customer quote before launch.
const TESTIMONIALS = [
  {
    quote: "Add a real customer quote here — ideally what changed for them after switching to Halvo.",
    name: "Customer name",
    role: "What they sell",
  },
  {
    quote: "A second quote lands best when it names a concrete outcome — a first sale, or hours saved.",
    name: "Customer name",
    role: "What they sell",
  },
  {
    quote: "Keep the third one short. One specific sentence, in their own words.",
    name: "Customer name",
    role: "What they sell",
  },
];

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-hero-glow">
          {/* Decorative depth — layered teal glows so the hero isn't a flat wash. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-8rem] h-72 w-[40rem] max-w-[120vw] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute right-[-5rem] top-40 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-4 left-[-5rem] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Now in early access
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-6xl">
              Sell digital products <span className="text-gradient">in minutes</span>.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Instant Stripe checkout, instant delivery, and payouts straight to your own account. No store to
              build, no code to write.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Free to start</span>
              <span aria-hidden="true">·</span>
              <span>No code</span>
              <span aria-hidden="true">·</span>
              <span>Paid out to your own Stripe</span>
            </p>
          </div>

          <div className="relative pb-16">
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

        {/* Social proof */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              {PROOF_STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                    {stat.value}
                  </dd>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                </div>
              ))}
            </dl>

            <h2 className="mt-14 text-center font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
              What creators say
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <Card key={t.quote} className="card-hover">
                  <CardContent className="flex h-full flex-col gap-3 pt-6">
                    <Quote className="h-5 w-5 shrink-0 text-primary/60" aria-hidden="true" />
                    <p className="flex-1 text-sm text-muted-foreground">{t.quote}</p>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
              Everything you need to sell
            </h2>
            <p className="mt-2 text-muted-foreground">No plugins, no storefront to build, no code.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="card-hover transition-transform duration-200 hover:-translate-y-1"
              >
                <CardContent className="flex gap-4 p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                Simple pricing
              </h2>
              <p className="mt-2 text-muted-foreground">Start free. Upgrade when you outgrow it.</p>
            </div>
            <div className="mt-12">
              <PricingTiers />
            </div>
            <p className="mt-10 text-center text-sm text-muted-foreground">
              <Link to="/pricing" className="text-primary underline underline-offset-4">
                Compare full plans
              </Link>
            </p>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-4xl">
              Your first product can be live in five minutes.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
              Free to start, paid out to your own Stripe, and you can cancel any time.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-7">
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
