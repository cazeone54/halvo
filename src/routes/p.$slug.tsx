import { createFileRoute, notFound } from "@tanstack/react-router";
import { getProductPublicView } from "@/lib/product-public.functions";
import { CheckoutWidget } from "@/components/checkout-widget";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    try {
      return await getProductPublicView({ data: { slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  component: ProductCheckoutPage,
});

function ProductCheckoutPage() {
  const product = Route.useLoaderData();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{product.name}</h1>
        {product.sellerName ? (
          <p className="text-sm text-muted-foreground">by {product.sellerName}</p>
        ) : null}
        {product.description ? <p className="mt-2 text-sm">{product.description}</p> : null}
        <p className="mt-2 text-lg font-medium">
          {product.payWhatYouWant ? "From " : ""}${(product.priceCents / 100).toFixed(2)}
        </p>
      </div>

      <CheckoutWidget
        product={{
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          payWhatYouWant: product.payWhatYouWant,
        }}
      />
    </div>
  );
}
