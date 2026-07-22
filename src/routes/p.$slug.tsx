import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShieldCheck, Mail, CircleCheck } from "lucide-react";
import { getProductPublicView } from "@/lib/product-public.functions";
import { CheckoutWidget } from "@/components/checkout-widget";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    try {
      return await getProductPublicView({ data: { slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  // Per-product SEO/social metadata — every checkout page used to inherit
  // the same generic "Halvo" title/description from the root layout, so a
  // seller sharing their product link anywhere (Twitter, Slack, iMessage)
  // got a preview card with no product info at all. og:image points at the
  // stable image proxy (see img.product.$productId.ts), not a short-lived
  // signed URL, so the preview doesn't go stale.
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const priceLabel = `$${(loaderData.priceCents / 100).toFixed(2)}`;
    const title = `${loaderData.name} — ${priceLabel}${loaderData.sellerName ? ` | ${loaderData.sellerName}` : ""}`;
    const description = loaderData.description ?? `Buy ${loaderData.name} on ${BRAND_NAME}.`;
    const imageUrl = loaderData.imageUrl ? `${BASE_URL}${loaderData.imageUrl}` : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10">
      {product.imageUrl ? (
        <div className="overflow-hidden rounded-2xl border shadow-sm">
          <img src={product.imageUrl} alt="" className="aspect-video w-full object-cover" />
        </div>
      ) : null}

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{product.name}</h1>
        {product.sellerName ? (
          <p className="text-sm text-muted-foreground">by {product.sellerName}</p>
        ) : null}
        {product.description ? <p className="mt-2 text-sm">{product.description}</p> : null}
        <p className="mt-2 text-lg font-medium">
          {product.payWhatYouWant ? "From " : ""}${(product.priceCents / 100).toFixed(2)}
        </p>
        {product.salesCount > 0 ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheck className="h-4 w-4 text-primary" />
            {product.salesCount} sold
          </p>
        ) : null}
      </div>

      <CheckoutWidget
        product={{
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          payWhatYouWant: product.payWhatYouWant,
        }}
      />

      {product.refundPolicy || product.supportEmail ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {product.refundPolicy ? (
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {product.refundPolicy}
            </p>
          ) : null}
          {product.supportEmail ? (
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Questions? <a href={`mailto:${product.supportEmail}`} className="underline">{product.supportEmail}</a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
