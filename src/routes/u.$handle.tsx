import { createFileRoute, notFound } from "@tanstack/react-router";
import { UserAvatar } from "@/components/user-avatar";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { getSellerStorefront } from "@/lib/storefront.functions";
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
            {/* In the header rather than under the grid, so the choice is
                visible before a buyer starts reading prices. */}
            {products.length > 0 ? (
              <CurrencySwitch current={currency} className="text-xs text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {/* The same shelf as Discover, from the same component: a seller's own
            page should look like the marketplace it sits in, not like a
            different website. The seller's name is left off the cards here —
            it's the name at the top of the page. */}
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <ProductGrid id="storefront-products">
            {paged.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {products.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products yet.</p>
            ) : null}
          </ProductGrid>
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
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
