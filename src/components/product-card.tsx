import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { Stars } from "@/components/stars";

// One product as it appears in a grid — on Discover and on a seller's own
// storefront, from this one definition, so the two can't drift into looking
// like different websites.
//
// The cover carries the selling: the description belongs on the product page,
// where it can be read, rather than pushing the next row off the screen.
export type GridProduct = {
  id: string;
  name: string;
  url_slug: string | null;
  imageUrl: string | null;
  price: { label: string; regularLabel: string | null };
  // Euro figures, used only to work out how much is off. The proportion is the
  // same whichever currency the labels above are in.
  price_cents: number;
  sale_price_cents?: number | null;
  ratingRounded: number;
  ratingCount: number;
  salesCount?: number;
  sellerName?: string | null;
};

// "-30%" on the cover while a launch price is running. Small discounts aren't
// worth a badge.
function discountLabel(p: GridProduct): string | null {
  if (!p.price.regularLabel || !p.sale_price_cents || !p.price_cents) return null;
  const off = Math.round((1 - p.sale_price_cents / p.price_cents) * 100);
  return off >= 5 ? `-${off}%` : null;
}

export function ProductCard({ product, showSeller = false }: { product: GridProduct; showSeller?: boolean }) {
  const discount = discountLabel(product);
  return (
    <Link
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
        {discount ? (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
            {discount}
          </span>
        ) : product.price.label === "Free" ? (
          <span className="absolute left-2 top-2 rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-semibold shadow-sm">
            Free
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-2">
        <h2 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{product.name}</h2>
        {/* Named on Discover, where products come from many sellers; left off a
            seller's own storefront, where every card would repeat it. */}
        {showSeller && product.sellerName ? (
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
          {(product.salesCount ?? 0) > 0 ? (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{product.salesCount} sold</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

// The grid itself, so both pages break at the same widths.
export function ProductGrid({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="grid scroll-mt-20 grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}

// Shown while results load, so the page doesn't open as an empty gap.
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2" aria-hidden="true">
          <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </>
  );
}
