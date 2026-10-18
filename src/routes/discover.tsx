import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Package, Search } from "lucide-react";
import { listDiscover, listDiscoverCategories, type DiscoverSort } from "@/lib/discover.functions";
import { Stars } from "@/components/stars";
import { Input } from "@/components/ui/input";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { cn } from "@/lib/utils";
import { usePagedList } from "@/lib/use-paged-list";
import { PAGE_SIZES } from "@/lib/paginate";
import { ListPager } from "@/components/list-pager";
import { CurrencySwitch } from "@/components/currency-switch";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

const SORT_LABELS: Array<{ value: DiscoverSort; label: string }> = [
  { value: "trending", label: "Trending" },
  { value: "best-selling", label: "Best selling" },
  { value: "newest", label: "Newest" },
];

// "-30%" on the cover when a launch price is running. Worked out from the euro
// figures, which is the same proportion in any currency the page is shown in.
function discountLabel(p: { price: { regularLabel: string | null }; price_cents: number; sale_price_cents?: number | null }): string | null {
  if (!p.price.regularLabel || !p.sale_price_cents || !p.price_cents) return null;
  const off = Math.round((1 - p.sale_price_cents / p.price_cents) * 100);
  return off >= 5 ? `-${off}%` : null;
}

export const Route = createFileRoute("/discover")({
  validateSearch: zodValidator(z.object({ q: z.string().optional() })),
  head: () => ({
    meta: [
      { title: `Discover digital products — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Browse digital products from independent creators on ${BRAND_NAME} — templates, presets, ebooks, software, fonts and more. Instant download after checkout.`,
      },
      { property: "og:title", content: `Discover digital products — ${BRAND_NAME}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/discover` },
    ],
    // Canonical is the clean URL so ?q= search variants don't fragment indexing.
    links: [{ rel: "canonical", href: `${BASE_URL}/discover` }],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<DiscoverSort>("trending");
  const discoverFn = useServerFn(listDiscover);
  const categoriesFn = useServerFn(listDiscoverCategories);

  // Debounce the text query: without this, every keystroke was a server
  // invocation and a DB query. Wait for a pause in typing.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const productsQ = useQuery({
    queryKey: ["discover", debouncedSearch, category, sort],
    queryFn: () =>
      discoverFn({ data: { search: debouncedSearch || undefined, category: category ?? undefined, sort } }),
  });
  const categoriesQ = useQuery({ queryKey: ["discover-categories"], queryFn: () => categoriesFn() });
  // Only offer the switch once there are real prices on screen to switch.
  const shownCurrency = productsQ.data?.[0]?.currency;
  const paged = usePagedList(
    productsQ.data ?? [],
    "halvo:discover:per-page",
    `${debouncedSearch}|${category}|${sort}`,
    20,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      {/* Wider than the reading pages on purpose: this is the shop floor, and
          at 768px a 1440px screen showed two products with half the window
          empty. */}
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Discover</h1>
          {productsQ.data ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {productsQ.data.length} product{productsQ.data.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <p className="w-full text-sm text-muted-foreground">Digital products from creators on Halvo.</p>
          {/* Up here with the heading, not under the grid: a buyer shouldn't
              have to scroll past every product to find out they can switch. */}
          {shownCurrency ? (
            <CurrencySwitch current={shownCurrency} className="w-full text-xs text-muted-foreground" />
          ) : null}
        </div>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SORT_LABELS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                sort === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Real buttons, not clickable badges: these are the shop's filters and
            they have to work from the keyboard. */}
        {categoriesQ.data && categoriesQ.data.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[null, ...categoriesQ.data].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                onClick={() => setCategory(c === null ? null : category === c ? null : c)}
                aria-pressed={category === c}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c ?? "All"}
              </button>
            ))}
          </div>
        ) : null}

        {/* A shelf, not an article: four across on a wide screen, two on a
            phone, and the cover doing the selling. Descriptions are left for
            the product page — in a grid they push the next row off screen and
            stop the covers being scannable. */}
        <div
          id="discover-results"
          className="mt-6 grid scroll-mt-20 grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4"
        >
          {productsQ.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2" aria-hidden="true">
                  <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                </div>
              ))
            : paged.items.map((product) => (
                <Link
                  key={product.id}
                  to="/p/$slug"
                  params={{ slug: product.url_slug! }}
                  className="group flex h-full flex-col focus-visible:outline-none"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted transition-colors group-hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-7 w-7" aria-hidden="true" />
                      </div>
                    )}
                    {discountLabel(product) ? (
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
                        {discountLabel(product)}
                      </span>
                    ) : product.price.label === "Free" ? (
                      <span className="absolute left-2 top-2 rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-semibold shadow-sm">
                        Free
                      </span>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-2">
                    <h2 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                      {product.name}
                    </h2>
                    {product.sellerName ? (
                      <p className="truncate text-xs text-muted-foreground">{product.sellerName}</p>
                    ) : null}

                    {product.ratingCount > 0 ? (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Stars value={product.ratingRounded} />
                        <span className="text-xs text-muted-foreground">({product.ratingCount})</span>
                      </div>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1.5">
                      <span className="font-semibold tabular-nums text-primary">{product.price.label}</span>
                      {product.price.regularLabel ? (
                        <s className="text-xs text-muted-foreground">{product.price.regularLabel}</s>
                      ) : null}
                      {product.salesCount > 0 ? (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {product.salesCount} sold
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
          {!productsQ.isLoading && productsQ.data?.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Nothing matches that yet. Try a different search, or clear the filters.
            </p>
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
                document.getElementById("discover-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onPageSize={paged.setPageSize}
            />
          </div>
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}
