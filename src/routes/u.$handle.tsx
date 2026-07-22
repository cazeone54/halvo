import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getSellerStorefront } from "@/lib/storefront.functions";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/u/$handle")({
  loader: async ({ params }) => {
    try {
      return await getSellerStorefront({ data: { handle: params.handle } });
    } catch {
      throw notFound();
    }
  },
  component: StorefrontPage,
});

function StorefrontPage() {
  const { profile, products } = Route.useLoaderData();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {profile.display_name ?? profile.handle}
        </h1>
        {profile.bio ? <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p> : null}
      </div>

      <div className="flex flex-col gap-3">
        {products.map((product) => (
          <Link key={product.id} to="/p/$slug" params={{ slug: product.url_slug! }}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.description ? (
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  ) : null}
                </div>
                <p className="font-medium">
                  {product.pay_what_you_want ? "From " : ""}${(product.price_cents / 100).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products yet.</p>
        ) : null}
      </div>
    </div>
  );
}
