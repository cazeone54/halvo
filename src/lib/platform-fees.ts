/**
 * What a seller keeps on each platform — the model behind /tools/fee-calculator
 * and the /compare pages.
 *
 * Pure: no React, no env. Halvo's own rate is passed in from plans.ts at the
 * call site, so this comparison can never disagree with what checkout charges.
 *
 * Scenario: a US seller, a US buyer, a card payment, priced in USD. That is the
 * primary market and the one case every platform publishes plainly. International
 * cards cost extra everywhere, by different amounts, so they are left out rather
 * than approximated.
 *
 * Every competitor rate was checked against that platform's own pricing page or
 * help centre on CHECKED_ON. This table is quoted in public — re-check the
 * sources before changing a number, and update CHECKED_ON when you do.
 */

export const CHECKED_ON = "2026-10-19";

export type PlatformId =
  | "halvo"
  | "gumroad"
  | "gumroad-discover"
  | "payhip"
  | "lemon-squeezy"
  | "stan";

export type Rate = { pct: number; fixedCents: number };

/** Stripe's standard US online card rate. Charged on top wherever a platform doesn't bundle processing. */
export const STRIPE_US: Rate = { pct: 0.029, fixedCents: 30 };

export const SOURCES: Record<Exclude<PlatformId, "halvo">, string> = {
  // 10% + $0.50 direct; processing NOT included (help centre). 30% via Discover, processing included.
  gumroad: "https://gumroad.com/pricing",
  "gumroad-discover": "https://gumroad.com/pricing",
  // Free 5% · Plus $29/mo 2% · Pro $99/mo 0%. Stripe/PayPal charge on top. Handles EU/UK VAT, US/CA sales tax.
  payhip: "https://payhip.com/pricing",
  // 5% + 50¢, card processing included. Merchant of record.
  "lemon-squeezy": "https://docs.lemonsqueezy.com/help/getting-started/fees",
  // Creator $29/mo, 0% platform fee, Stripe on top. Not merchant of record.
  stan: "https://stan.store",
};

export type PlatformResult = {
  id: PlatformId;
  name: string;
  /** Which plan the figures use — for Payhip, whichever is cheapest for the scenario. */
  plan: string | null;
  monthlyFeeCents: number;
  /** Platform fee plus card processing on one sale, excluding any monthly fee. */
  perSaleFeeCents: number;
  /** What reaches the seller in a month: revenue minus every fee, monthly fee included. */
  monthlyKeepCents: number;
  /** True when the platform collects and remits sales tax / VAT for the seller. */
  handlesTax: boolean;
};

const pctOf = (cents: number, pct: number) => Math.round(cents * pct);

/** A free product has no charge, so nothing to process and no per-sale fee. */
function perSale(priceCents: number, platform: Rate, processing: Rate | null): number {
  if (priceCents <= 0) return 0;
  const proc = processing ? pctOf(priceCents, processing.pct) + processing.fixedCents : 0;
  return pctOf(priceCents, platform.pct) + platform.fixedCents + proc;
}

function result(
  id: PlatformId,
  name: string,
  plan: string | null,
  priceCents: number,
  salesPerMonth: number,
  monthlyFeeCents: number,
  perSaleFeeCents: number,
  handlesTax: boolean,
): PlatformResult {
  const sales = Math.max(0, Math.floor(salesPerMonth));
  return {
    id,
    name,
    plan,
    monthlyFeeCents,
    perSaleFeeCents,
    monthlyKeepCents: sales * (priceCents - perSaleFeeCents) - monthlyFeeCents,
    handlesTax,
  };
}

const PAYHIP_PLANS = [
  { plan: "Free", monthlyFeeCents: 0, pct: 0.05 },
  { plan: "Plus", monthlyFeeCents: 2900, pct: 0.02 },
  { plan: "Pro", monthlyFeeCents: 9900, pct: 0 },
] as const;

/**
 * Every platform for one price and monthly volume, best for the seller first.
 * Ties keep input order, so Halvo is listed ahead of an exact equal.
 */
export function comparePlatforms(priceCents: number, salesPerMonth: number, halvo: Rate): PlatformResult[] {
  const price = Math.max(0, Math.round(priceCents));

  const payhip = PAYHIP_PLANS.map((p) =>
    result(
      "payhip",
      "Payhip",
      p.plan,
      price,
      salesPerMonth,
      p.monthlyFeeCents,
      perSale(price, { pct: p.pct, fixedCents: 0 }, STRIPE_US),
      true,
    ),
  ).reduce((best, r) => (r.monthlyKeepCents > best.monthlyKeepCents ? r : best));

  const rows: PlatformResult[] = [
    result("halvo", "Halvo", null, price, salesPerMonth, 0, perSale(price, halvo, STRIPE_US), false),
    result("lemon-squeezy", "Lemon Squeezy", null, price, salesPerMonth, 0, perSale(price, { pct: 0.05, fixedCents: 50 }, null), true),
    payhip,
    result("gumroad", "Gumroad", "Direct sales", price, salesPerMonth, 0, perSale(price, { pct: 0.1, fixedCents: 50 }, STRIPE_US), true),
    result("stan", "Stan Store", "Creator", price, salesPerMonth, 2900, perSale(price, { pct: 0, fixedCents: 0 }, STRIPE_US), false),
    result("gumroad-discover", "Gumroad", "Sold via Discover", price, salesPerMonth, 0, perSale(price, { pct: 0.3, fixedCents: 0 }, null), true),
  ];

  return rows.sort((a, b) => b.monthlyKeepCents - a.monthlyKeepCents);
}

/**
 * How many sales a month at this price before Stan Store's flat $29 costs less
 * than Halvo's per-sale fee. Stripe's card fee is identical on both (each uses
 * the seller's own Stripe), so it cancels out. Null when there is no crossover.
 */
export function stanCrossoverSales(priceCents: number, halvo: Rate): number | null {
  const halvoFee = priceCents > 0 ? pctOf(priceCents, halvo.pct) + halvo.fixedCents : 0;
  if (halvoFee <= 0) return null;
  return Math.ceil(2900 / halvoFee);
}
