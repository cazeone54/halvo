import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Search } from "lucide-react";
import { listDiscover, listDiscoverCategories, type DiscoverSort } from "@/lib/discover.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { cn } from "@/lib/utils";

const SORT_LABELS: Array<{ value: DiscoverSort; label: string }> = [
  { value: "trending", label: "Trending" },
  { value: "best-selling", label: "Best selling" },
  { value: "newest", label: "Newest" },
];

export const Route = createFileRoute("/discover")({
  validateSearch: zodValidator(z.object({ q: z.string().optional() })),
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

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Discover</h1>
          <p className="mt-1 text-sm text-muted-foreground">Browse digital products from creators on Halvo.</p>
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

        {categoriesQ.data && categoriesQ.data.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant={category === null ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setCategory(null)}
            >
              All
            </Badge>
            {categoriesQ.data.map((c) => (
              <Badge
                key={c}
                variant={category === c ? "default" : "outline"}
                className={cn("cursor-pointer capitalize")}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {c}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(productsQ.data ?? []).map((product) => (
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
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="font-semibold text-primary">
                      {!product.pay_what_you_want && product.price_cents === 0
                        ? "Free"
                        : `${product.pay_what_you_want ? "From " : ""}$${(product.price_cents / 100).toFixed(2)}`}
                    </p>
                    {product.salesCount > 0 ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{product.salesCount} sold</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {productsQ.data?.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products found.</p>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
