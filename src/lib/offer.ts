// Honest scarcity: a limited number of copies, and a launch price that really
// ends. Both are enforced at checkout, never just displayed. Pure, so the
// rules are unit-tested in one place.
import { MIN_CHARGE_CENTS } from "@/lib/fees";

export const MAX_SALE_DAYS = 90;
export const MAX_STOCK = 100_000;

export type OfferFields = {
  price_cents: number;
  pay_what_you_want: boolean;
  sale_price_cents?: number | null;
  sale_ends_at?: string | null;
  stock_limit?: number | null;
};

// The sale price if a sale is running right now, else null. A sale only ever
// lowers a fixed price, never to below what Stripe can charge.
export function activeSalePriceCents(p: OfferFields, now: Date): number | null {
  if (p.pay_what_you_want) return null;
  if (p.sale_price_cents == null || !p.sale_ends_at) return null;
  const ends = Date.parse(p.sale_ends_at);
  if (!Number.isFinite(ends) || now.getTime() >= ends) return null;
  if (p.sale_price_cents >= p.price_cents || p.sale_price_cents < MIN_CHARGE_CENTS) return null;
  return p.sale_price_cents;
}

// The pricing checkout should use right now.
export function effectivePricing(p: OfferFields, now: Date): { price_cents: number; pay_what_you_want: boolean } {
  return { price_cents: activeSalePriceCents(p, now) ?? p.price_cents, pay_what_you_want: p.pay_what_you_want };
}

export function stockRemaining(limit: number | null | undefined, sold: number): number | null {
  if (limit == null) return null;
  return Math.max(0, limit - sold);
}

// "2d 4h", "3h 12m", "12m 05s", "45s" — coarse when far, precise when close.
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

// Validates what a seller sets. Returns an error message, or null if fine.
export function validateOffer(
  input: {
    priceCents: number;
    payWhatYouWant: boolean;
    salePriceCents: number | null;
    saleEndsAt: string | null;
    stockLimit: number | null;
    soldCount: number;
  },
  now: Date,
): string | null {
  if (input.stockLimit != null) {
    if (!Number.isInteger(input.stockLimit) || input.stockLimit < 1 || input.stockLimit > MAX_STOCK) {
      return `Copies available must be between 1 and ${MAX_STOCK.toLocaleString("en-US")}.`;
    }
    if (input.stockLimit < input.soldCount) {
      return `You've already sold ${input.soldCount} — set at least that many copies.`;
    }
  }
  if ((input.salePriceCents == null) !== (input.saleEndsAt == null)) {
    return "A launch price needs both a price and an end date.";
  }
  if (input.salePriceCents != null && input.saleEndsAt != null) {
    if (input.payWhatYouWant) return "Pay-what-you-want products can't have a launch price.";
    if (input.priceCents === 0) return "Free products can't have a launch price.";
    if (input.salePriceCents >= input.priceCents) return "The launch price must be lower than the regular price.";
    if (input.salePriceCents < MIN_CHARGE_CENTS) {
      return `The launch price must be at least $${(MIN_CHARGE_CENTS / 100).toFixed(2)}.`;
    }
    const ends = Date.parse(input.saleEndsAt);
    if (!Number.isFinite(ends)) return "Pick a valid end date.";
    if (ends <= now.getTime()) return "The end date must be in the future.";
    if (ends - now.getTime() > MAX_SALE_DAYS * 86_400_000) {
      return `A launch price can run for at most ${MAX_SALE_DAYS} days — otherwise it's just the price.`;
    }
  }
  return null;
}
