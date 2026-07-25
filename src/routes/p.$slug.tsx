import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Mail, CircleCheck, Lock, Zap, CreditCard } from "lucide-react";
import { getProductPublicView } from "@/lib/product-public.functions";
import { listProductReviews } from "@/lib/reviews.functions";
import { Stars } from "@/components/stars";
import { CheckoutWidget } from "@/components/checkout-widget";
import { Logo, LogoMark } from "@/components/logo";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    try {
      return await getProductPublicView({ data: { slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  // ?embed=1 means this page is rendered inside the overlay iframe on a
  // seller's own site (see public/embed.js). In that mode we don't want brand
  // links to hijack the iframe — they open Halvo in a new tab instead.
  validateSearch: (search: Record<string, unknown>): { embed?: boolean } => ({
    embed: search.embed === "1" || search.embed === 1 || search.embed === true ? true : undefined,
  }),
  // Per-product SEO/social metadata — every checkout page used to inherit
  // the same generic "Halvo" title/description from the root layout, so a
  // seller sharing their product link anywhere (Twitter, Slack, iMessage)
  // got a preview card with no product info at all. og:image points at the
  // stable image proxy (see img.product.$productId.ts), not a short-lived
  // signed URL, so the preview doesn't go stale.
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const priceLabel = `$${(loaderData.priceCents / 100).toFixed(2)}`;
    const title = `${loaderData.name} — ${priceLabel}${loaderData.sellerName ? ` | ${loaderData.sellerName}` : ""}`;
    const description = loaderData.description ?? `Buy ${loaderData.name} on ${BRAND_NAME}.`;
    const imageUrl = loaderData.imageUrl ? `${BASE_URL}${loaderData.imageUrl}` : undefined;
    const url = `${BASE_URL}/p/${params.slug}`;

    // Product structured data → price/availability rich results in search.
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: loaderData.name,
      ...(loaderData.description ? { description: loaderData.description } : {}),
      ...(imageUrl ? { image: imageUrl } : {}),
      offers: {
        "@type": "Offer",
        price: (loaderData.priceCents / 100).toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url,
      },
    };

    return {
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
        { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(imageUrl ? [{ name: "twitter:image", content: imageUrl }] : []),
      ],
    };
  },
  component: ProductCheckoutPage,
});

function ProductCheckoutPage() {
  const product = Route.useLoaderData();
  const { embed } = Route.useSearch();
  const reviewsFn = useServerFn(listProductReviews);
  const reviewsQ = useQuery({
    queryKey: ["product-reviews", product.id],
    queryFn: () => reviewsFn({ data: { productId: product.id } }),
  });
  const summary = reviewsQ.data?.summary;
  const isFree = !product.payWhatYouWant && product.priceCents === 0;
  const priceLabel = isFree
    ? "Free"
    : `${product.payWhatYouWant ? "From " : ""}$${(product.priceCents / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Minimal, distraction-free header — no nav on a checkout page, just a
          brand mark and a security cue to build trust. */}
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-4 sm:px-6">
        {/* In an embedded overlay, the mark must not navigate the iframe. */}
        {embed ? (
          <Logo markClassName="h-6 w-6" />
        ) : (
          <Link to="/">
            <Logo markClassName="h-6 w-6" />
          </Link>
        )}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Secure checkout
        </span>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-16 sm:px-6">
        {/* Product card */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="aspect-video w-full object-cover" />
          ) : null}
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">
                  {product.name}
                </h1>
                {product.sellerName ? (
                  <p className="text-sm text-muted-foreground">by {product.sellerName}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-[family-name:var(--font-display)] text-xl font-semibold text-primary sm:text-2xl">
                {priceLabel}
              </p>
            </div>
            {product.description ? (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {product.salesCount > 0 ? (
                <div className="flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary">
                  <CircleCheck className="h-4 w-4" />
                  <span className="font-medium">{product.salesCount}</span> already sold
                </div>
              ) : null}
              {summary && summary.count > 0 ? (
                <div className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground">
                  <Stars value={summary.rounded} />
                  <span className="font-medium text-foreground">{summary.average}</span>
                  <span>
                    ({summary.count} review{summary.count === 1 ? "" : "s"})
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Checkout card */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <CheckoutWidget
            product={{
              id: product.id,
              name: product.name,
              priceCents: product.priceCents,
              payWhatYouWant: product.payWhatYouWant,
            }}
          />
        </div>

        {/* Trust strip — right where hesitation happens, all statements true */}
        <div className="grid grid-cols-3 gap-2">
          <TrustItem icon={Zap} label="Instant download" />
          <TrustItem icon={Lock} label={isFree ? "No card needed" : "Secure checkout"} />
          <TrustItem icon={CreditCard} label={isFree ? "No payment" : "Powered by Stripe"} />
        </div>

        {reviewsQ.data && reviewsQ.data.reviews.length > 0 ? (
          <div className="rounded-2xl border bg-card p-5">
            <p className="font-[family-name:var(--font-display)] font-semibold">What buyers say</p>
            <div className="mt-4 flex flex-col gap-4">
              {reviewsQ.data.reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                  <Stars value={review.rating} />
                  <p className="mt-1.5 text-sm text-muted-foreground">{review.body}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Every checkout quietly advertises the platform — the Calendly loop.
            Understated on purpose: it must never compete with the seller's own
            brand or distract from the buy button. When embedded, open Halvo in
            a new tab so a curious buyer discovers us without losing checkout. */}
        {embed ? (
          <a
            href={BASE_URL}
            target="_blank"
            rel="noreferrer"
            className="mx-auto flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Powered by
            <LogoMark className="h-3.5 w-3.5" />
            <span className="font-medium">{BRAND_NAME}</span>
          </a>
        ) : (
          <Link
            to="/"
            className="mx-auto flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Powered by
            <LogoMark className="h-3.5 w-3.5" />
            <span className="font-medium">{BRAND_NAME}</span>
          </Link>
        )}

        {product.refundPolicy || product.supportEmail ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            {product.refundPolicy ? (
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {product.refundPolicy}
              </p>
            ) : null}
            {product.supportEmail ? (
              <p className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Questions?{" "}
                <a href={`mailto:${product.supportEmail}`} className="underline underline-offset-2">
                  {product.supportEmail}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: typeof Lock; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-3 text-center">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}
