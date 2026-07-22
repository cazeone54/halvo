import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { listDiscover } from "@/lib/discover.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/discover")({
  validateSearch: zodValidator(z.object({ q: z.string().optional() })),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const discoverFn = useServerFn(listDiscover);

  const productsQ = useQuery({
    queryKey: ["discover", search],
    queryFn: () => discoverFn({ data: { search: search || undefined } }),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse digital products from creators on Halvo.</p>
      </div>

      <Input
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex flex-col gap-3">
        {(productsQ.data ?? []).map((product) => (
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
        {productsQ.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products found.</p>
        ) : null}
      </div>
    </div>
  );
}
