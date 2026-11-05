import { describe, expect, it } from "vitest";
import { buildAnalyticsReport, type ReportInput, type SaleRow } from "./analytics-report";

const now = new Date("2026-10-27T15:00:00Z");
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

let n = 0;
const sale = (over: Partial<SaleRow>): SaleRow => ({
  id: `t${++n}`,
  amount_paid_cents: 1000,
  currency: "eur",
  status: "success",
  refunded_at: null,
  product_id: A,
  created_at: "2026-10-20T10:00:00+00:00",
  ...over,
});
const view = (product_id: string, created_at: string, source: string | null = "instagram.com") => ({ product_id, source, created_at });

const base = (over: Partial<ReportInput> = {}): ReportInput => ({
  period: 30,
  now,
  productId: null,
  products: [
    { id: A, name: "Alpha" },
    { id: B, name: "Beta" },
    { id: "cccccccc-0000-4000-8000-000000000003", name: "Never seen" },
  ],
  sales: [],
  views: [],
  saleSources: [],
  memberships: [],
  links: [],
  clicks: [],
  hasShopViews: false,
  ...over,
});

describe("headline numbers", () => {
  it("leave out refunds and free downloads, and compare with the period before", () => {
    const r = buildAnalyticsReport(
      base({
        sales: [
          sale({ id: "s1" }),
          sale({ id: "s2", currency: "usd", amount_paid_cents: 2000 }),
          sale({ id: "s3", refunded_at: "2026-10-21T00:00:00Z" }),
          sale({ id: "s4", amount_paid_cents: 0 }),
          sale({ id: "s5", created_at: "2026-09-10T10:00:00Z" }), // the 30 days before
        ],
        views: [view(A, "2026-10-20T09:00:00Z"), view(A, "2026-10-21T09:00:00Z"), view(A, "2026-09-10T09:00:00Z")],
      }),
    );
    expect(r.kpis.revenue.value).toEqual({ eur: 1000, usd: 2000 });
    expect(r.kpis.sales).toEqual({ value: 2, change: 100 });
    expect(r.kpis.views).toEqual({ value: 2, change: 100 });
    expect(r.kpis.conversion.value).toBe(100);
    expect(r.kpis.conversion.pointsChange).toBe(0);
  });

  it("has nothing to compare with for all time", () => {
    const r = buildAnalyticsReport(base({ period: 0, sales: [sale({})] }));
    expect(r.kpis.sales).toEqual({ value: 1, change: null });
  });
});

describe("chart", () => {
  it("puts every measure in each bar, adding up to the headline numbers", () => {
    const r = buildAnalyticsReport(
      base({
        sales: [sale({ created_at: "2026-10-27T08:00:00Z" }), sale({ created_at: "2026-10-27T09:00:00Z", currency: "usd" })],
        views: [view(A, "2026-10-27T07:00:00Z"), view(B, "2026-10-01T07:00:00Z")],
      }),
    );
    expect(r.chart).toHaveLength(30);
    expect(r.chart[29]).toMatchObject({ key: "2026-10-27", views: 1, sales: 2, revenue: { eur: 1000, usd: 1000 } });
    expect(r.chart.reduce((a, p) => a + p.views, 0)).toBe(r.kpis.views.value);
    expect(r.chart.reduce((a, p) => a + p.sales, 0)).toBe(r.kpis.sales.value);
  });
});

describe("where people come from", () => {
  it("gives each place its views, sales and money on one row", () => {
    const r = buildAnalyticsReport(
      base({
        views: [
          view(A, "2026-10-20T09:00:00Z", "instagram.com"),
          view(A, "2026-10-20T09:00:00Z", "l.instagram.com"),
          view(A, "2026-10-20T09:00:00Z", "Direct"),
          view(A, "2026-10-20T09:00:00Z", null),
        ],
        sales: [sale({ id: "x1" }), sale({ id: "x2" })],
        saleSources: [{ transaction_id: "x1", source: "ig" }],
      }),
    );
    expect(r.sources).toEqual([
      { source: "Instagram", views: 2, sales: 1, revenue: { eur: 1000 } },
      { source: "Unknown", views: 1, sales: 1, revenue: { eur: 1000 } },
      { source: "Direct", views: 1, sales: 0, revenue: {} },
    ]);
  });
});

describe("products", () => {
  it("lists every product with something happening, money first", () => {
    const r = buildAnalyticsReport(
      base({
        views: [view(A, "2026-10-20T09:00:00Z"), view(B, "2026-10-20T09:00:00Z"), view(B, "2026-10-20T09:00:00Z")],
        sales: [
          sale({ product_id: B, amount_paid_cents: 500 }),
          sale({ product_id: A, amount_paid_cents: 0 }),
          sale({ product_id: "gone", amount_paid_cents: 900 }),
        ],
      }),
    );
    expect(r.productRows.map((p) => [p.name, p.views, p.sales, p.free])).toEqual([
      ["A removed product", 0, 1, 0],
      ["Beta", 2, 1, 0],
      ["Alpha", 1, 0, 1],
    ]);
  });

  it("offers only products that have had a view or a sale in the picker", () => {
    const r = buildAnalyticsReport(base({ views: [view(B, "2026-01-01T00:00:00Z")], sales: [sale({})] }));
    expect(r.products.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });
});

describe("one product", () => {
  const input = base({
    productId: B,
    views: [view(A, "2026-10-20T09:00:00Z"), view(B, "2026-10-20T09:00:00Z")],
    sales: [sale({ product_id: A }), sale({ product_id: B, amount_paid_cents: 700 })],
    links: [{ id: "l1", title: "My site", url: "https://example.com" }],
  });

  it("scopes every number to that product", () => {
    const r = buildAnalyticsReport(input);
    expect(r.productId).toBe(B);
    expect(r.kpis.revenue.value).toEqual({ eur: 700 });
    expect(r.kpis.views.value).toBe(1);
    expect(r.sources).toEqual([
      { source: "Instagram", views: 1, sales: 0, revenue: {} },
      { source: "Unknown", views: 0, sales: 1, revenue: { eur: 700 } },
    ]);
    // The product table and the shop's links aren't about one product.
    expect(r.productRows).toEqual([]);
    expect(r.links).toBeNull();
  });

  it("shows the whole shop for a product that isn't the seller's", () => {
    const r = buildAnalyticsReport({ ...input, productId: "someone-elses" });
    expect(r.productId).toBeNull();
    expect(r.kpis.views.value).toBe(2);
  });
});

describe("memberships", () => {
  const member = (over: Partial<ReportInput["memberships"][number]>) => ({
    product_id: A,
    kind: "membership",
    status: "active",
    amount_cents: 1000,
    currency: "eur",
    billing_interval: "month",
    created_at: "2026-06-01T00:00:00Z",
    ended_at: null,
    ...over,
  });

  it("counts live members, monthly money per currency, and who joined or left", () => {
    const r = buildAnalyticsReport(
      base({
        memberships: [
          member({}),
          member({ billing_interval: "year", amount_cents: 12000, created_at: "2026-10-10T00:00:00Z" }),
          member({ currency: "usd", status: "past_due" }),
          member({ status: "canceled", ended_at: "2026-10-15T00:00:00Z" }),
          member({ kind: "installments" }),
        ],
      }),
    );
    expect(r.memberships).toEqual({ active: 3, monthly: { eur: 2000, usd: 1000 }, joined: 1, left: 1 });
  });

  it("is hidden for a seller who has never had a member", () => {
    expect(buildAnalyticsReport(base({ memberships: [member({ kind: "installments" })] })).memberships).toBeNull();
  });
});

describe("links", () => {
  it("counts taps on each current link in the period, most tapped first", () => {
    const r = buildAnalyticsReport(
      base({
        links: [
          { id: "l1", title: "Newsletter", url: "https://a.example" },
          { id: "l2", title: "YouTube", url: "https://b.example" },
        ],
        clicks: [
          { link_id: "l2", created_at: "2026-10-20T00:00:00Z" },
          { link_id: "l2", created_at: "2026-10-21T00:00:00Z" },
          { link_id: "l1", created_at: "2026-08-01T00:00:00Z" }, // before the period
          { link_id: "deleted", created_at: "2026-10-21T00:00:00Z" },
        ],
      }),
    );
    expect(r.links).toEqual([
      { id: "l2", title: "YouTube", taps: 2 },
      { id: "l1", title: "Newsletter", taps: 0 },
    ]);
  });
});

describe("empty shop", () => {
  it("says there's nothing yet, unless the shop page has had visits", () => {
    expect(buildAnalyticsReport(base()).hasAnyActivity).toBe(false);
    expect(buildAnalyticsReport(base({ hasShopViews: true })).hasAnyActivity).toBe(true);
  });
});
