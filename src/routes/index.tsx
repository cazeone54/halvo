import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Wallet, Percent, Code2, ArrowRight, ShieldCheck, Users2, Unlock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PersonaMarquee } from "@/components/persona-marquee";
import { ExplainerAnimation } from "@/components/explainer-animation";
import { PricingTiers } from "@/components/pricing-tiers";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { UserAvatar } from "@/components/user-avatar";
import { getHomeShowcase } from "@/lib/showcase.functions";
import { BRAND_NAME, BASE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  // Real products and a real shop for the page. If that read fails, the page
  // still renders — just without those two sections.
  loader: async () => {
    try {
      return await getHomeShowcase();
    } catch {
      return null;
    }
  },
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
          // Raster logo — Google's logo feature doesn't accept SVG.
          logo: `${BASE_URL}/logo.png`,
        }),
      },
      {
        // WebSite + SearchAction → eligible for a sitelinks search box, wired to
        // the existing /discover search.
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: BRAND_NAME,
          url: BASE_URL,
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${BASE_URL}/discover?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
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
    body: "Every sale is paid into your own Stripe account, so your money lands in your balance automatically. No payout requests, no waiting on us.",
  },
  {
    icon: Percent,
    title: "Discounts & affiliates",
    body: "Run percent-off or flat discount codes, and let affiliates earn a commission on every sale they refer.",
  },
  {
    icon: Code2,
    title: "Buy button for your own site",
    body: "Drop one snippet on your Webflow, Framer, WordPress or Ghost site and buyers check out in a popup without leaving the page.",
  },
];

// The single biggest hesitation on a brand-new payments platform is "will I
// actually get paid, and is my money safe?" — so these three promises are the
// trust anchor. Every one is literally true of how Halvo works.
const TRUST = [
  {
    icon: Wallet,
    title: "Paid to your own Stripe",
    body: "Your share is paid to your own connected Stripe account and pays out on your schedule — no waiting on us, no manual payout requests.",
  },
  {
    icon: Users2,
    title: "Your customers are yours",
    body: "Every buyer's email is yours to keep and export, any time. We never get between you and your audience.",
  },
  {
    icon: Unlock,
    title: "No lock-in",
    body: "Cancel whenever you want and take everything with you — your products, your list, your links.",
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

// What a Halvo shop page gives a seller — every line true of the shop today.
const SHOP_POINTS = [
  "Your products in a grid, in your colour, with your banner and news across the top",
  "A free download at the top that collects email addresses",
  "Your Instagram, TikTok and other links in one place",
  "Checkout and instant download on every product",
];

type Showcase = Awaited<ReturnType<typeof getHomeShowcase>>;

// A real shop, drawn small inside a browser window, from the same data its
// page uses — not a screenshot that goes out of date.
function ShopPreview({ shop }: { shop: NonNullable<Showcase["shop"]> }) {
  return (
    <Link
      to="/$handle"
      params={{ handle: shop.handle }}
      aria-label={`Open ${shop.name}'s shop at halvo.io/${shop.handle}`}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-xl transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="mx-auto min-w-0 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          halvo.io/{shop.handle}
        </span>
      </div>
      <div className="bg-hero-glow px-5 pb-5 pt-6 text-center">
        <UserAvatar
          src={shop.avatarUrl}
          name={shop.name}
          className="mx-auto h-14 w-14 bg-primary/10 text-primary ring-4 ring-background"
          textClassName="text-lg"
          iconClassName="h-6 w-6"
        />
        <p className="mt-2 font-[family-name:var(--font-display)] font-semibold">{shop.name}</p>
        {shop.bio ? <p className="mx-auto mt-0.5 line-clamp-2 max-w-xs text-xs text-muted-foreground">{shop.bio}</p> : null}
      </div>
      <div className="grid grid-cols-3 gap-2.5 p-4">
        {shop.products.map((p) => (
          <div key={p.id} className="min-w-0">
            <div className="aspect-video overflow-hidden rounded-md border bg-muted">
              {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}
            </div>
            <p className="mt-1 truncate text-[11px] font-medium">{p.name}</p>
            <p className="text-[11px] font-semibold tabular-nums text-primary">{p.price.label}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

function HomePage() {
  const showcase = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
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

        {/* Real products rather than a description of them: the newest on sale,
            each one opening the checkout a buyer would see. */}
        {showcase && showcase.products.length >= 4 ? (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                  On sale on {BRAND_NAME} right now
                </h2>
                <p className="mt-1 text-muted-foreground">Real products. Open any of them to see what your buyers would see.</p>
              </div>
              <Link to="/discover" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Browse everything <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <ProductGrid>
              {showcase.products.map((p, i) => (
                // Four on a phone, six on a tablet, eight on a computer: always full rows.
                <div key={p.id} className={cn(i >= 6 ? "hidden lg:block" : i >= 4 ? "hidden md:block" : "")}>
                  <ProductCard product={p} />
                </div>
              ))}
            </ProductGrid>
          </section>
        ) : null}

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
            See how it works
          </h2>
          <p className="mt-2 text-center text-muted-foreground">30 seconds: list a product, get paid.</p>
          <div className="mt-6">
            <ExplainerAnimation />
          </div>
        </section>

        {showcase?.shop ? (
          <section className="border-t bg-muted/30">
            <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                  One link for everything you sell
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Your shop lives at halvo.io/yourname. Put it in your bio and send everyone there.
                </p>
                <ul className="mt-6 flex flex-col gap-3 text-sm">
                  {SHOP_POINTS.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Button asChild size="lg">
                    <Link to="/login">
                      Start your shop
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Link
                    to="/$handle"
                    params={{ handle: showcase.shop.handle }}
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    See a real one
                  </Link>
                </div>
              </div>
              <ShopPreview shop={showcase.shop} />
            </div>
          </section>
        ) : null}

        {/* Trust anchor — answered loudly and high on the page, because "will I
            get paid?" is the real reason a first seller hesitates on a new
            payments platform. */}
        <section className="border-y bg-primary/5">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <ShieldCheck className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              Your money is yours.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
              Every sale is paid into your own Stripe account through Stripe Connect. We only ever take our platform
              fee — your payouts and your customer list stay yours.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              {TRUST.map((t) => (
                <div key={t.title} className="rounded-xl border bg-card p-5">
                  <t.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-[family-name:var(--font-display)] font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
                </div>
              ))}
            </div>
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
              <p className="mt-2 text-muted-foreground">One plan. No monthly fee. You pay only when you sell.</p>
            </div>
            <div className="mt-12">
              <PricingTiers />
            </div>
            <p className="mt-10 text-center text-sm text-muted-foreground">
              <Link to="/pricing" className="text-primary underline underline-offset-4">
                See what's included
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
