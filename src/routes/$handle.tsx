import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Facebook, Globe, Instagram, Linkedin, Music2, Package, Twitter, Youtube, type LucideIcon } from "lucide-react";
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
import { isReservedHandle, type SocialPlatform } from "@/lib/link-in-bio";
import type { CSSProperties } from "react";

// A seller's page at halvo.io/<handle> — short enough to go in an Instagram
// bio, which is where most of these links will live. Static pages (/pricing,
// /discover…) always win over this route, and reserved words are refused as
// handles, so a shop can never shadow one of Halvo's own pages.
export const Route = createFileRoute("/$handle")({
  loader: async ({ params }) => {
    const handle = params.handle.toLowerCase();
    if (!/^[a-z0-9_-]{3,32}$/.test(handle) || isReservedHandle(handle)) throw notFound();
    try {
      return await getSellerStorefront({ data: { handle } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const name = loaderData.profile.display_name ?? loaderData.profile.handle ?? params.handle;
    const title = `${name} — ${BRAND_NAME}`;
    const description = loaderData.profile.bio ?? `Digital products from ${name} on ${BRAND_NAME}.`;
    const url = `${BASE_URL}/${loaderData.profile.handle ?? params.handle}`;
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

// lucide has no TikTok mark; a music note with the name read out is the
// honest stand-in rather than a hand-drawn imitation of their logo.
const SOCIAL_ICONS: Record<SocialPlatform, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
};

function StorefrontPage() {
  const { profile, products, currency, social, links, featured } = Route.useLoaderData();
  const brandStyle = brandThemeStyle(profile.accent_color);
  const paged = usePagedList(products, "halvo:storefront:per-page", profile.handle ?? "");
  const handle = profile.handle ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn("flex-1", brandStyle && "brand-theme")}
        style={brandStyle as CSSProperties | undefined}
      >
        {/* The link-in-bio part: one narrow column, sized for the phone a
            follower tapped through from, the same on every screen. */}
        <div className="border-b bg-hero-glow">
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
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
                <p className="mx-auto mt-1 max-w-sm whitespace-pre-line text-sm text-muted-foreground">{profile.bio}</p>
              ) : null}
            </div>

            {social.length > 0 ? (
              <nav aria-label={`${profile.display_name ?? handle} elsewhere`} className="flex flex-wrap justify-center gap-2">
                {social.map((s) => {
                  const Icon = SOCIAL_ICONS[s.platform];
                  return (
                    <a
                      key={s.platform}
                      href={s.url}
                      rel="me nofollow noopener"
                      aria-label={s.label}
                      title={s.label}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  );
                })}
              </nav>
            ) : null}

            {featured.length > 0 || links.length > 0 ? (
              <div className="flex w-full flex-col gap-3 pt-1">
                {featured.map((p) => (
                  <Link
                    key={p.id}
                    to="/p/$slug"
                    params={{ slug: p.url_slug! }}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-2 pr-3 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{p.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
                        <span className="font-semibold tabular-nums text-primary">{p.price.label}</span>
                        {p.price.regularLabel ? (
                          <s className="text-xs text-muted-foreground">{p.price.regularLabel}</s>
                        ) : null}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {p.price.label === "Free" ? "Get" : "Buy"}
                    </span>
                  </Link>
                ))}
                {links.map((l) => (
                  // Through /go/ so the seller can see what gets tapped; the
                  // address is looked up server-side from the id.
                  <a
                    key={l.id}
                    href={`/go/${handle}/${l.id}`}
                    rel="nofollow ugc"
                    className="block w-full rounded-xl border bg-card px-4 py-3.5 text-center text-sm font-semibold shadow-sm transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {l.title}
                  </a>
                ))}
              </div>
            ) : null}

            {/* Before the prices, so a buyer can switch before reading them. */}
            {products.length > 0 ? (
              <CurrencySwitch current={currency} className="text-xs text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {/* The same shelf as Discover, from the same component. */}
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          {products.length > 0 ? (
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">
              All products <span className="font-normal text-muted-foreground">({products.length})</span>
            </h2>
          ) : null}
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
