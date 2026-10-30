import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Search } from "lucide-react";
import { listDiscover, listDiscoverCategories, type DiscoverSort } from "@/lib/discover.functions";
import { Input } from "@/components/ui/input";
import { ProductCard, ProductGrid, ProductGridSkeleton } from "@/components/product-card";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/category-label";
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
  // Picking the category that's already on goes back to everything.
  const pickCategory = (c: string | null) => setCategory(c === null ? null : category === c ? null : c);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      {/* Wider than the reading pages on purpose: this is the shop floor, and
          at 768px a 1440px screen showed two products with half the window
          empty. */}
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <div className="lg:flex lg:gap-8">
          {/* On a computer the filters run down the left, always in view while
              the grid scrolls. Smaller screens get them as buttons above it. */}
          <aside aria-label="Filters" className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-20 flex flex-col gap-6">
              <FilterList
                title="Sort by"
                items={SORT_LABELS.map(({ value, label }) => ({ key: value, label, active: sort === value, onPick: () => setSort(value) }))}
              />
              {categoriesQ.data && categoriesQ.data.length > 0 ? (
                <FilterList
                  title="Categories"
                  items={[null, ...categoriesQ.data].map((c) => ({
                    key: c ?? "all",
                    label: c === null ? "All products" : categoryLabel(c),
                    active: category === c,
                    onPick: () => pickCategory(c),
                  }))}
                />
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
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

            <div className="mt-3 flex flex-wrap gap-1.5 lg:hidden">
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
              <div className="mt-3 flex flex-wrap gap-1.5 lg:hidden">
                {[null, ...categoriesQ.data].map((c) => (
                  <button
                    key={c ?? "all"}
                    type="button"
                    onClick={() => pickCategory(c)}
                    aria-pressed={category === c}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c === null ? "All" : categoryLabel(c)}
                  </button>
                ))}
              </div>
            ) : null}

            {/* A shelf, not an article: four across on a wide screen, two on a
                phone, and the cover doing the selling. Descriptions are left for
                the product page — in a grid they push the next row off screen and
                stop the covers being scannable. */}
            <div className="mt-6">
              <ProductGrid id="discover-results">
                {productsQ.isLoading ? (
                  <ProductGridSkeleton />
                ) : (
                  paged.items.map((product) => <ProductCard key={product.id} product={product} showSeller />)
                )}
                {!productsQ.isLoading && productsQ.data?.length === 0 ? (
                  <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                    Nothing matches that yet. Try a different search, or clear the filters.
                  </p>
                ) : null}
              </ProductGrid>
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
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

// One group of filters in the left column: a heading and a list of options,
// the chosen one highlighted. Real buttons, so they work from the keyboard.
function FilterList({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; active: boolean; onPick: () => void }>;
}) {
  return (
    <div role="group" aria-label={title}>
      <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onPick}
            aria-pressed={item.active}
            className={cn(
              "w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
              item.active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
