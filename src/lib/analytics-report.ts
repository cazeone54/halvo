// Everything the Analytics page shows, worked out from the seller's raw rows.
// Pure, so every number on that page is tested rather than assumed; the server
// function (analytics.functions.ts) only reads the rows and calls this.

import { addTo, totalsWeight, type MoneyTotals } from "@/lib/currency";
import { conversionRatePct } from "@/lib/conversion";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/lib/account-closure";
import type { BioLink } from "@/lib/link-in-bio";
import {
  bucketFinder,
  pctChange,
  periodWindow,
  sourceLabel,
  timeBuckets,
  type Bucket,
  type Period,
} from "@/lib/analytics-math";

export type SaleRow = {
  id: string;
  amount_paid_cents: number;
  currency: string;
  status: string;
  refunded_at: string | null;
  product_id: string;
  created_at: string;
};
export type ViewRow = { product_id: string; source: string | null; created_at: string };
export type SaleSourceRow = { transaction_id: string; source: string | null };
export type MembershipRow = {
  product_id: string | null;
  kind: string;
  status: string;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  created_at: string;
  ended_at: string | null;
};
export type ClickRow = { link_id: string; created_at: string };

export type ReportInput = {
  period: Period;
  now: Date;
  productId: string | null; // one product, or null for the whole shop
  products: ReadonlyArray<{ id: string; name: string }>;
  sales: readonly SaleRow[];
  views: readonly ViewRow[];
  saleSources: readonly SaleSourceRow[];
  memberships: readonly MembershipRow[];
  links: readonly BioLink[];
  clicks: readonly ClickRow[];
  hasShopViews: boolean;
};

export type ChartPoint = Bucket & { views: number; sales: number; revenue: MoneyTotals };
export type SourceRow = { source: string; views: number; sales: number; revenue: MoneyTotals };
export type ProductRow = {
  id: string;
  name: string;
  removed: boolean; // sold once, since deleted
  views: number;
  sales: number;
  free: number;
  revenue: MoneyTotals;
};
export type MembershipSummary = { active: number; monthly: MoneyTotals; joined: number; left: number };
export type LinkRow = { id: string; title: string; taps: number };
export type AnalyticsReport = ReturnType<typeof buildAnalyticsReport>;

const LIVE: readonly string[] = LIVE_SUBSCRIPTION_STATUSES;

export function buildAnalyticsReport(input: ReportInput) {
  const { period, now } = input;
  const { since, prevSince } = periodWindow(period, now);
  const inCur = (iso: string) => !since || Date.parse(iso) >= since.getTime();
  const inPrev = (iso: string) =>
    !!since && !!prevSince && Date.parse(iso) >= prevSince.getTime() && Date.parse(iso) < since.getTime();

  const names = new Map(input.products.map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? "A removed product";
  // A product that isn't this seller's (or no longer exists) shows the whole shop.
  const productId = input.productId && names.has(input.productId) ? input.productId : null;
  const scoped = <T extends { product_id: string | null }>(rows: readonly T[]) =>
    productId ? rows.filter((r) => r.product_id === productId) : rows;

  const views = scoped(input.views);
  const sales = scoped(input.sales);
  // Revenue and sales leave out refunded orders: that money went back.
  const paid = sales.filter((r) => r.status === "success" && !r.refunded_at && r.amount_paid_cents > 0);
  const free = sales.filter((r) => r.status === "success" && r.amount_paid_cents === 0);
  const curViews = views.filter((v) => inCur(v.created_at));
  const curPaid = paid.filter((r) => inCur(r.created_at));
  const prevViews = views.filter((v) => inPrev(v.created_at)).length;
  const prevPaid = paid.filter((r) => inPrev(r.created_at));
  const revenue = (rows: readonly SaleRow[]) => rows.reduce<MoneyTotals>((t, r) => addTo(t, r.currency, r.amount_paid_cents), {});

  // --- Headline numbers, with the period before for comparison.
  const curRevenue = revenue(curPaid);
  const curRate = conversionRatePct(curPaid.length, curViews.length);
  const prevRate = conversionRatePct(prevPaid.length, prevViews);
  const compare = period !== 0;
  const kpis = {
    revenue: { value: curRevenue, change: compare ? pctChange(totalsWeight(curRevenue), totalsWeight(revenue(prevPaid))) : null },
    sales: { value: curPaid.length, change: compare ? pctChange(curPaid.length, prevPaid.length) : null },
    views: { value: curViews.length, change: compare ? pctChange(curViews.length, prevViews) : null },
    // A change in a rate is reported in points (2.1% → 2.6% is +0.5), not as
    // a percentage of a percentage.
    conversion: { value: curRate, pointsChange: compare && curRate != null && prevRate != null ? curRate - prevRate : null },
  };

  // --- One bar per day / week / month, every measure in each, so the chart
  // can switch between them without asking the server again.
  const buckets = timeBuckets(period, now);
  const bucketOf = bucketFinder(buckets);
  const chart: ChartPoint[] = buckets.map((b) => ({ ...b, views: 0, sales: 0, revenue: {} }));
  for (const v of views) {
    const i = bucketOf(v.created_at);
    if (i >= 0) chart[i].views += 1;
  }
  for (const r of paid) {
    const i = bucketOf(r.created_at);
    if (i < 0) continue;
    chart[i].sales += 1;
    addTo(chart[i].revenue, r.currency, r.amount_paid_cents);
  }

  // --- Where people come from: views and sales per place, so each place's
  // conversion can be read off the same row.
  const saleSource = new Map(input.saleSources.map((s) => [s.transaction_id, s.source]));
  const bySource = new Map<string, SourceRow>();
  const sourceRow = (label: string) => {
    const row = bySource.get(label) ?? { source: label, views: 0, sales: 0, revenue: {} };
    bySource.set(label, row);
    return row;
  };
  for (const v of curViews) sourceRow(sourceLabel(v.source)).views += 1;
  for (const r of curPaid) {
    const row = sourceRow(sourceLabel(saleSource.get(r.id) ?? null));
    row.sales += 1;
    addTo(row.revenue, r.currency, r.amount_paid_cents);
  }
  const sources = [...bySource.values()].sort(
    (a, b) => b.views - a.views || b.sales - a.sales || a.source.localeCompare(b.source),
  );

  // --- Every product with something happening in the period. Not needed when
  // the page is already showing one product.
  const byProduct = new Map<string, ProductRow>();
  const productRow = (id: string) => {
    const row = byProduct.get(id) ?? { id, name: nameOf(id), removed: !names.has(id), views: 0, sales: 0, free: 0, revenue: {} };
    byProduct.set(id, row);
    return row;
  };
  if (!productId) {
    for (const v of curViews) productRow(v.product_id).views += 1;
    for (const r of curPaid) {
      const row = productRow(r.product_id);
      row.sales += 1;
      addTo(row.revenue, r.currency, r.amount_paid_cents);
    }
    for (const r of free) if (inCur(r.created_at)) productRow(r.product_id).free += 1;
  }
  const productRows = [...byProduct.values()].sort(
    (a, b) =>
      totalsWeight(b.revenue) - totalsWeight(a.revenue) ||
      b.sales - a.sales ||
      b.free - a.free ||
      b.views - a.views ||
      a.name.localeCompare(b.name),
  );

  // --- Memberships, only for a seller who has ever had a member. Monthly
  // income is per currency (euro and dollar members are never added together)
  // with a yearly plan counted as a twelfth.
  let memberships: MembershipSummary | null = null;
  const everyMember = input.memberships.filter((m) => m.kind === "membership");
  const members = productId ? everyMember.filter((m) => m.product_id === productId) : everyMember;
  if (members.length > 0) {
    const live = members.filter((m) => LIVE.includes(m.status) && !m.ended_at);
    memberships = {
      active: live.length,
      monthly: live.reduce<MoneyTotals>(
        (t, m) => addTo(t, m.currency, Math.round(m.billing_interval === "year" ? m.amount_cents / 12 : m.amount_cents)),
        {},
      ),
      joined: members.filter((m) => inCur(m.created_at)).length,
      left: members.filter((m) => m.ended_at && inCur(m.ended_at)).length,
    };
  }

  // --- Taps on each link on the seller's page (its current links only). Not
  // about any one product, so not shown for one.
  let links: LinkRow[] | null = null;
  if (!productId && input.links.length > 0) {
    const taps = new Map<string, number>();
    for (const c of input.clicks) if (inCur(c.created_at)) taps.set(c.link_id, (taps.get(c.link_id) ?? 0) + 1);
    links = input.links
      .map((l) => ({ id: l.id, title: l.title, taps: taps.get(l.id) ?? 0 }))
      .sort((a, b) => b.taps - a.taps);
  }

  // The product picker lists what has ever had a view or a sale; a product
  // with neither would only show an empty page.
  const active = new Set([...input.views.map((v) => v.product_id), ...input.sales.map((r) => r.product_id)]);
  const products = input.products
    .filter((p) => active.has(p.id) || p.id === productId)
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    period,
    productId,
    hasAnyActivity: input.sales.length > 0 || input.views.length > 0 || input.hasShopViews,
    products,
    kpis,
    chart,
    sources,
    productRows,
    memberships,
    links,
  };
}
