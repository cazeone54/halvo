import { activeSalePriceCents } from "@/lib/offer";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type PricedProduct = {
  price_cents: number;
  pay_what_you_want: boolean;
  sale_price_cents?: number | null;
  sale_ends_at?: string | null;
  billing_type?: string | null;
  billing_interval?: string | null;
};

// The one way a product's price is shown anywhere — product page, storefront,
// Discover, cross-sells — so a running launch price or a membership interval
// can't show on one surface and not another. Computed on the server (it
// depends on the clock) and passed down as text.
export function listingPrice(p: PricedProduct, now = new Date()): { label: string; regularLabel: string | null } {
  if (!p.pay_what_you_want && p.price_cents === 0) return { label: "Free", regularLabel: null };
  const sale = activeSalePriceCents(p, now);
  const per = p.billing_type === "membership" ? ` / ${p.billing_interval === "year" ? "year" : "month"}` : "";
  return {
    label: `${p.pay_what_you_want ? "From " : ""}${formatCents(sale ?? p.price_cents)}${per}`,
    regularLabel: sale != null ? formatCents(p.price_cents) : null,
  };
}
