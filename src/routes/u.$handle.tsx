import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { User, Package } from "lucide-react";
import { getSellerStorefront } from "@/lib/storefront.functions";
import { Stars } from "@/components/stars";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/u/$handle")({
  loader: async ({ params }) => {
    try {
      return await getSellerStorefront({ data: { handle: params.handle } });
    } catch {
      throw notFound();
    }
  },
  // A storefront used to inherit the generic homepage title, so every seller's
  // page looked identical to search engines and link previews.
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const name = loaderData.profile.display_name ?? loaderData.profile.handle ?? params.handle;
    const title = `${name} — ${BRAND_NAME}`;
    const description = loaderData.profile.bio ?? `Digital products from ${name} on ${BRAND_NAME}.`;
    const url = `${BASE_URL}/u/${params.handle}`;
    const imageUrl = loaderData.profile.avatarUrl ? `${BASE_URL}${loaderData.profile.avatarUrl}` : undefined;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: StorefrontPage,
});

function StorefrontPage() {
  const { profile, products } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* Branded header band */}
        <div className="border-b bg-hero-glow">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary shadow-sm ring-4 ring-background">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-9 w-9" />
              )}
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                {profile.display_name ?? profile.handle}
              </h1>
              {profile.bio ? (
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{profile.bio}</p>
              ) : null}
            </div>
            {products.length > 0 ? (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {products.length} product{products.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </div>

        {/* Products */}
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <Link key={product.id} to="/p/$slug" params={{ slug: product.url_slug! }}>
                <Card className="card-hover h-full overflow-hidden">
                  <div className="flex aspect-video w-full items-center justify-center bg-muted">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <CardContent className="pt-4">
                    <p className="font-medium">{product.name}</p>
                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                    ) : null}
                    {product.ratingCount > 0 ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Stars value={product.ratingRounded} />
                        <span className="text-xs text-muted-foreground">
                          {product.ratingAverage.toFixed(1)} ({product.ratingCount})
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 font-semibold text-primary">
                      {!product.pay_what_you_want && product.price_cents === 0
                        ? "Free"
                        : `${product.pay_what_you_want ? "From " : ""}$${(product.price_cents / 100).toFixed(2)}`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {products.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products yet.</p>
            ) : null}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
