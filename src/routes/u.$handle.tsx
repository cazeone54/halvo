import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { getSellerStorefront } from "@/lib/storefront.functions";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";

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
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary shadow-sm">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {profile.display_name ?? profile.handle}
          </h1>
          {profile.bio ? <p className="max-w-md text-sm text-muted-foreground">{profile.bio}</p> : null}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <Link key={product.id} to="/p/$slug" params={{ slug: product.url_slug! }}>
              <Card className="card-hover h-full overflow-hidden">
                <div className="aspect-video w-full bg-muted">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <CardContent className="pt-4">
                  <p className="font-medium">{product.name}</p>
                  {product.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                  ) : null}
                  <p className="mt-2 font-medium">
                    {product.pay_what_you_want ? "From " : ""}${(product.price_cents / 100).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {products.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products yet.</p>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
