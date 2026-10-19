import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap,
  Download,
  Wallet,
  Percent,
  Users2,
  Sparkles,
  Package,
  Star,
  BarChart3,
  Code2,
  Gift,
  Layers,
  ShieldCheck,
  Store,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { AI_COPYWRITER_ENABLED, BRAND_NAME, BASE_URL } from "@/lib/site";
import { DIRECT_CHARGES, PLAN_LIMITS } from "@/lib/plans";

// Derived so a copy change can never claim a rate the checkout doesn't charge.
// This page previously advertised "from 4%" — the old Pro tier — which stopped
// being true the moment tiers were retired.
const FEE_PCT = Math.round(PLAN_LIMITS.free.platformFeePct * 100);
const FEE_FIXED = PLAN_LIMITS.free.platformFeeFixedCents;
const FEE = FEE_FIXED > 0 ? `${FEE_PCT}% + ${FEE_FIXED}¢` : `${FEE_PCT}%`;

// Under DESTINATION charges the platform absorbs Stripe's processing fee, so
// the platform fee genuinely is the seller's whole cost. Under DIRECT charges
// Stripe bills the seller's own account, so there is a second line on their
// statement and saying "all-in" would be false.
const FEE_ALL_IN = !DIRECT_CHARGES;
const FEE_NOTE = FEE_ALL_IN
  ? "No monthly charge and no tiers. That one fee covers card processing too, so it's your whole cost."
  : "No monthly charge and no tiers. Stripe's standard processing fee is billed to your own Stripe account on top.";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: `Features — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Everything ${BRAND_NAME} does: instant Stripe checkout and delivery, payouts to your own Stripe, discounts, affiliates, bundles, order bumps, ${AI_COPYWRITER_ENABLED ? "an AI copywriter, " : ""}an embeddable buy button, and analytics — ${FEE} per sale, no monthly fee.`,
      },
      { property: "og:title", content: `Features — ${BRAND_NAME}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/features` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/features` }],
  }),
  component: FeaturesPage,
});

type Feature = { icon: typeof Zap; title: string; body: string };

const SELL: Feature[] = [
  { icon: Zap, title: "Instant checkout", body: "Stripe-powered checkout with Apple Pay, Google Pay and card — no account required for buyers." },
  { icon: Download, title: "Instant delivery", body: "The download unlocks the second payment succeeds, and the link is emailed too." },
  { icon: Percent, title: "Pay what you want", body: "Let buyers name their price above a floor you set — great for tips and launches." },
  { icon: Gift, title: "Free lead magnets", body: "Give a file away for an email address. No card, no Stripe onboarding needed." },
  { icon: Layers, title: "Bundles & order bumps", body: "Package products together, and offer a one-click add-on right at checkout." },
  ...(AI_COPYWRITER_ENABLED
    ? [{ icon: Sparkles, title: "AI copywriter", body: "Turn a rough pitch into a polished product name and description in seconds." }]
    : []),
  { icon: Code2, title: "Embeddable buy button", body: "Drop one snippet on any site — Webflow, Framer, WordPress — and buyers check out in a popup." },
];

const GET_PAID: Feature[] = [
  { icon: Wallet, title: "Payouts to your own Stripe", body: "Every sale routes through Stripe Connect straight to your account. We never hold your money." },
  { icon: Percent, title: `One fee, ${FEE}`, body: FEE_NOTE },
  { icon: ShieldCheck, title: "Refunds & disputes handled", body: "Issue refunds in a click, and chargebacks are recorded with the evidence to fight them." },
  { icon: Users2, title: "Your customer list is yours", body: "Every buyer's email is yours to keep and export — not locked inside the platform." },
];

const GROW: Feature[] = [
  { icon: Percent, title: "Discount codes", body: "Run percent-off coupons, activate and deactivate them any time." },
  { icon: Users2, title: "Affiliate program", body: "Let others earn a commission on every sale they refer — funded from the sale, tracked automatically." },
  { icon: Store, title: "Your own storefront", body: "A clean public page at halvo.io/u/you that lists everything you sell." },
  { icon: BarChart3, title: "Real analytics", body: "Revenue, sales, page views, conversion rate and where your buyers came from." },
  { icon: Star, title: "Verified reviews", body: "Only real, completed purchases can leave a rating — social proof you can trust." },
  { icon: Package, title: "Discover marketplace", body: "Get found by buyers browsing Halvo, on top of the traffic you bring yourself." },
];

function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((f) => (
        <Card key={f.title} className="card-hover">
          <CardContent className="flex gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
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
  );
}

function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* Hero */}
        <section className="border-b bg-hero-glow">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-5xl">
              Everything you need to <span className="text-gradient">sell digital products</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              One tool for checkout, delivery, payouts and growth — paid straight to your own Stripe, {FEE} a sale
              with no monthly fee.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Sell anything digital</h2>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">A checkout that closes</p>
            <FeatureGrid items={SELL} />
          </section>

          <section className="mt-16">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Get paid, your way</h2>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">Your money, your account</p>
            <FeatureGrid items={GET_PAID} />
          </section>

          <section className="mt-16">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Grow your sales</h2>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">More buyers, bigger orders</p>
            <FeatureGrid items={GROW} />
          </section>

          {/* CTA */}
          <section className="mt-20 rounded-2xl border bg-muted/30 px-6 py-12 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              Your first product can be live in five minutes.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Free to start, paid out to your own Stripe, cancel any time.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link to="/login">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
