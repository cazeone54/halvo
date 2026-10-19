import { useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { FeeComparison } from "@/components/fee-comparison";
import { Button } from "@/components/ui/button";
import { UNIVERSAL_FEE_PCT } from "@/lib/plans";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

const HALVO_PCT = `${Math.round(UNIVERSAL_FEE_PCT * 100)}%`;

const TITLE = "Digital product fee calculator: Gumroad, Stan Store, Payhip, Lemon Squeezy";
const DESCRIPTION =
  "Put in your price and monthly sales and see what Gumroad, Stan Store, Payhip, Lemon Squeezy and Halvo actually leave you after every fee — card processing and monthly plans included.";

// Written as the answers people search for. They are also the page's
// FAQPage structured data, so keep them true and keep them in step with
// platform-fees.ts.
const FAQS = [
  {
    q: "Does Gumroad's 10% fee include card processing?",
    a: "No. On direct sales Gumroad charges 10% + $0.50, and card processing is charged on top. On sales that come through Gumroad's Discover marketplace the fee is 30%, with processing included. Gumroad does collect and remit sales tax and VAT for you as merchant of record.",
  },
  {
    q: "Is Stan Store cheaper than Gumroad?",
    a: "It depends how much you sell. Stan Store's Creator plan is $29 a month with no platform fee per sale, so it gets cheaper the more you sell. In a slow month it costs more than any per-sale platform, and in a month with no sales it still costs $29.",
  },
  {
    q: "Which platforms handle sales tax and VAT for you?",
    a: "Gumroad, Lemon Squeezy and Payhip collect and remit it for you. Stan Store and Halvo do not — with either, your tax is yours to handle.",
  },
  {
    q: "Lemon Squeezy is often cheaper on a US sale. Why use Halvo?",
    a: `On a single US card sale Lemon Squeezy often leaves you a little more, and it handles your tax. If you are on Lemon Squeezy or Payhip and happy, the numbers say you can stay. Halvo is clearly cheaper than Gumroad, and cheaper than Stan Store until you are selling around twenty products a month, and it pays into your own Stripe account rather than through a merchant of record.`,
  },
  {
    q: `What does ${BRAND_NAME} charge?`,
    a: `${HALVO_PCT} of each sale, and nothing else: no monthly fee, no listing fee, nothing in a month you don't sell. Stripe charges its own card fee to your Stripe account on top, the same as it would on your own website.`,
  },
];

type Search = { price?: number; sales?: number };

export const Route = createFileRoute("/tools/fee-calculator")({
  // Price and volume live in the URL so a result can be linked to — "here is
  // what your $9 product costs on each" is the thing people share.
  validateSearch: (s: Record<string, unknown>): Search => {
    const price = Number(s.price);
    const sales = Number(s.sales);
    return {
      price: Number.isFinite(price) && price >= 0 && price <= 100_000 ? price : undefined,
      sales: Number.isFinite(sales) && sales >= 0 && sales <= 100_000 ? Math.floor(sales) : undefined,
    };
  },
  head: () => {
    const url = `${BASE_URL}/tools/fee-calculator`;
    return {
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
      meta: [
        { title: `${TITLE} — ${BRAND_NAME}` },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
      ],
    };
  },
  component: FeeCalculatorPage,
});

function FeeCalculatorPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onChange = useCallback(
    (price: number, sales: number) => {
      void navigate({ search: { price, sales }, replace: true, resetScroll: false });
    },
    [navigate],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="border-b bg-hero-glow">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-20">
            <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Free tool
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-5xl">
              What you actually keep on each platform
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Gumroad, Stan Store, Payhip, Lemon Squeezy and {BRAND_NAME}, with every fee counted — card processing and
              monthly plans included. We show it even where we're not the cheapest.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <FeeComparison initialPrice={search.price ?? 29} initialSales={search.sales ?? 5} onChange={onChange} />
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Questions people ask</h2>
          <dl className="mt-6 flex flex-col gap-6">
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1.5 text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link to="/compare/$slug" params={{ slug: "gumroad" }} className="text-primary underline-offset-4 hover:underline">
              {BRAND_NAME} vs Gumroad
            </Link>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <Link to="/compare/$slug" params={{ slug: "stan-store" }} className="text-primary underline-offset-4 hover:underline">
              {BRAND_NAME} vs Stan Store
            </Link>
          </div>
        </section>

        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              If {BRAND_NAME} comes out ahead for you
            </h2>
            <p className="mx-auto mt-2 max-w-md text-primary-foreground/80">
              It takes about two minutes to put a product up. Nothing to pay until it sells.
            </p>
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
