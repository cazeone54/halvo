import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { getSellerStorefront } from "@/lib/storefront.functions";
import { Stars } from "@/components/stars";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { BRAND_NAME, BASE_URL } from "@/lib/site";
import { brandThemeStyle } from "@/lib/brand-color";
import { cn } from "@/lib/utils";
import { usePagedList } from "@/lib/use-paged-list";
import { PAGE_SIZES } from "@/lib/paginate";
import { ListPager } from "@/components/list-pager";
import { CurrencySwitch } from "@/components/currency-switch";
import type { CSSProperties } from "react";

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
    const title = `${name} â€” ${BRAND_NAME}`;
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
  const { profile, products, currency } = Route.useLoaderData();
  const brandStyle = brandThemeStyle(profile.accent_color);
  const paged = usePagedList(products, "halvo:storefront:per-page", profile.handle ?? "");

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn("flex-1", brandStyle && "brand-theme")}
        style={brandStyle as CSSProperties | undefined}
      >
        {/* Branded header band */}
        <div className="border-b bg-hero-glow">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6">
            <UserAvatar
              src={profile.avatarUrl}
              name={profile.display_name ?? profile.handle}
              className="h-24 w-24 bg-primary/10 text-primary shadow-sm ring-4 ring-background"
              textClassName="text-3xl"
              iconClassName="h-9 w-9"
            />
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
          <div id="storefront-products" className="grid scroll-mt-20 grid-cols-1 gap-4 sm:grid-cols-2">
            {paged.items.map((product) => (
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
                      {product.price.label}
                      {product.price.regularLabel ? (<s className="ml-1.5 text-xs font-normal text-muted-foreground">{product.price.regularLabel}</s>) : null}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {products.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products yet.</p>
            ) : null}
          </div>
          {paged.total > PAGE_SIZES[0] ? (
            <div className="mt-6">
              <ListPager
                label="Products"
                page={paged.page}
                pageCount={paged.pageCount}
                from={paged.from}
                to={paged.to}
                total={paged.total}
                pageSize={paged.pageSize}
                onPage={(p) => {
                  paged.setPage(p);
                  document.getElementById("storefront-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onPageSize={paged.setPageSize}
              />
            </div>
          ) : null}
          {/* Same choice the product page offers, so a buyer browsing a
              storefront isn't stuck with a currency until they click in. */}
          {products.length > 0 ? <CurrencySwitch current={currency} /> : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
