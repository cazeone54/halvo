import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addTo, asCurrency, formatTotals, totalsWeight, type Currency, type MoneyTotals } from "@/lib/currency";
import {
  isPeriod,
  pctChange,
  periodWindow,
  sourceLabel,
  stableTopKeys,
  toSlices,
  type DonutData,
  type Period,
} from "@/lib/analytics-math";
import { conversionRatePct } from "@/lib/conversion";

// Splits stop meaning anything when they're made of a handful of events — on
// 17 Oct the per-source rows were removed for exactly that reason, when every
// one read "Direct". So each chart waits for enough data to be worth reading.
const MIN_VISITS = 30;
const MIN_PAID_SALES = 10;
const MIN_PRODUCTS = 2;

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

// The API hands back at most 1,000 rows per request, so a busy seller's views
// would quietly stop counting at 1,000. Read in pages instead, capped so one
// very large account can't stall the page.
const PAGE = 1000;
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cap = 50_000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return { data: out, error: null };
}

export const getMyAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ period: z.number().optional() }).optional().parse(data))
  .handler(async ({ data, context }) => {
    const period: Period = isPeriod(data?.period) ? (data!.period as Period) : 30;
    const now = new Date();
    const { since, prevSince } = periodWindow(period, now);
    const inCur = (iso: string) => !since || Date.parse(iso) >= since.getTime();
    const inPrev = (iso: string) =>
      !!since && !!prevSince && Date.parse(iso) >= prevSince.getTime() && Date.parse(iso) < since.getTime();

    const { data: rows, error } = await readAll((from, to) =>
      context.supabase
        .from("transactions")
        .select("id, amount_paid_cents, currency, status, refunded_at, product_id, created_at, products(name)")
        .eq("seller_id", context.userId)
        .order("id")
        .range(from, to),
    );
    if (error) throw new Error(error.message);

    // Revenue and sales leave out refunded orders: that money went back.
    const paid = rows.filter((r) => r.status === "success" && !r.refunded_at && r.amount_paid_cents > 0);
    const productName = new Map<string, string>();
    for (const r of rows) {
      productName.set(r.product_id, (r.products as unknown as { name: string } | null)?.name ?? "A removed product");
    }

    // Each of these is read defensively: a missing migration costs the page
    // that one number, never the whole page. RLS scopes every read to this seller.
    const [viewsRes, shopRes, sourcesRes] = await Promise.all([
      readAll((from, to) => context.supabase.from("product_views").select("product_id, source, created_at").order("id").range(from, to)),
      readAll((from, to) =>
        context.supabase.from("shop_views").select("source, created_at").eq("seller_id", context.userId).order("id").range(from, to),
      ),
      readAll((from, to) =>
        context.supabase.from("sale_sources").select("transaction_id, source").eq("seller_id", context.userId).order("id").range(from, to),
      ),
    ]);
    const views = viewsRes.error ? [] : viewsRes.data;
    const shopViews = shopRes.error ? [] : shopRes.data;
    const saleSource = new Map((sourcesRes.error ? [] : sourcesRes.data).map((s) => [s.transaction_id, s.source]));

    // --- Headline numbers, with the period before for comparison.
    const revenue = (list: typeof paid) => list.reduce<MoneyTotals>((t, r) => addTo(t, r.currency, r.amount_paid_cents), {});
    const curPaid = paid.filter((r) => inCur(r.created_at));
    const prevPaid = paid.filter((r) => inPrev(r.created_at));
    const curViews = views.filter((v) => inCur(v.created_at)).length;
    const prevViews = views.filter((v) => inPrev(v.created_at)).length;
    const curRevenue = revenue(curPaid);
    const prevRevenue = revenue(prevPaid);
    const curRate = conversionRatePct(curPaid.length, curViews);
    const prevRate = conversionRatePct(prevPaid.length, prevViews);
    const compare = period !== 0;

    const kpis = {
      revenue: { value: curRevenue, change: compare ? pctChange(totalsWeight(curRevenue), totalsWeight(prevRevenue)) : null },
      sales: { value: curPaid.length, change: compare ? pctChange(curPaid.length, prevPaid.length) : null },
      views: { value: curViews, change: compare ? pctChange(curViews, prevViews) : null },
      // A change in a rate is reported in points (2.1% → 2.6% is +0.5), not as
      // a percentage of a percentage.
      conversion: { value: curRate, pointsChange: compare && curRate != null && prevRate != null ? curRate - prevRate : null },
    };

    // --- Circle 1: where visits come from (shop page + product pages).
    const visitAll = new Map<string, number>();
    const visitCur = new Map<string, number>();
    for (const v of [...shopViews, ...views]) {
      const label = sourceLabel(v.source);
      visitAll.set(label, (visitAll.get(label) ?? 0) + 1);
      if (inCur(v.created_at)) visitCur.set(label, (visitCur.get(label) ?? 0) + 1);
    }
    const visitTotal = [...visitCur.values()].reduce((a, b) => a + b, 0);
    const visitSplit = toSlices(visitCur, stableTopKeys(visitAll));
    const visitsDonut: DonutData = {
      ready: visitTotal >= MIN_VISITS,
      have: visitTotal,
      need: MIN_VISITS,
      totalLabel: count(visitTotal, "visit"),
      slices: visitSplit.slices.map((s) => ({ key: s.key, label: s.key, valueLabel: count(s.value, "visit"), share: s.share, slot: s.slot })),
    };

    // --- Circle 2: where paying buyers come from.
    const buyerAll = new Map<string, number>();
    const buyerCur = new Map<string, number>();
    for (const r of paid) {
      const label = sourceLabel(saleSource.get(r.id) ?? null);
      buyerAll.set(label, (buyerAll.get(label) ?? 0) + 1);
      if (inCur(r.created_at)) buyerCur.set(label, (buyerCur.get(label) ?? 0) + 1);
    }
    const buyerSplit = toSlices(buyerCur, stableTopKeys(buyerAll));
    const buyersDonut: DonutData = {
      ready: curPaid.length >= MIN_PAID_SALES,
      have: curPaid.length,
      need: MIN_PAID_SALES,
      totalLabel: count(curPaid.length, "sale"),
      slices: buyerSplit.slices.map((s) => ({ key: s.key, label: s.key, valueLabel: count(s.value, "sale"), share: s.share, slot: s.slot })),
    };

    // --- Circle 3: which products bring the money (shares weighed across
    // currencies; each value shown in its own currencies).
    const moneyAll = new Map<string, MoneyTotals>();
    const moneyCur = new Map<string, MoneyTotals>();
    for (const r of paid) {
      moneyAll.set(r.product_id, addTo(moneyAll.get(r.product_id) ?? {}, r.currency, r.amount_paid_cents));
      if (inCur(r.created_at)) moneyCur.set(r.product_id, addTo(moneyCur.get(r.product_id) ?? {}, r.currency, r.amount_paid_cents));
    }
    const weigh = (m: Map<string, MoneyTotals>) => new Map([...m.entries()].map(([k, v]) => [k, totalsWeight(v)]));
    const productSplit = toSlices(weigh(moneyCur), stableTopKeys(weigh(moneyAll)));
    const otherMoney = [...moneyCur.entries()]
      .filter(([id]) => !productSplit.slices.some((s) => s.key === id))
      .reduce<MoneyTotals>((t, [, v]) => {
        for (const [cur, cents] of Object.entries(v)) addTo(t, cur, cents as number);
        return t;
      }, {});
    const productsDonut: DonutData = {
      ready: moneyCur.size >= MIN_PRODUCTS,
      have: moneyCur.size,
      need: MIN_PRODUCTS,
      totalLabel: formatTotals(curRevenue),
      slices: productSplit.slices.map((s) => ({
        key: s.key,
        label: s.key === "Other" ? "Other products" : productName.get(s.key) ?? "A product",
        valueLabel: formatTotals(s.key === "Other" ? otherMoney : moneyCur.get(s.key) ?? {}),
        share: s.share,
        slot: s.slot,
      })),
    };

    // --- Top products for the period, with views and conversion.
    const viewsByProduct = new Map<string, number>();
    for (const v of views) if (inCur(v.created_at)) viewsByProduct.set(v.product_id, (viewsByProduct.get(v.product_id) ?? 0) + 1);
    const salesByProduct = new Map<string, number>();
    for (const r of curPaid) salesByProduct.set(r.product_id, (salesByProduct.get(r.product_id) ?? 0) + 1);
    const topProducts = [...moneyCur.entries()]
      .map(([id, rev]) => ({ id, name: productName.get(id) ?? "A product", revenue: rev, sales: salesByProduct.get(id) ?? 0, views: viewsByProduct.get(id) ?? 0 }))
      .sort((a, b) => totalsWeight(b.revenue) - totalsWeight(a.revenue));

    // --- Revenue over time, one series per currency (never added together).
    const series = new Map<Currency, Map<string, number>>();
    for (const r of curPaid) {
      const c = asCurrency(r.currency);
      const s = series.get(c) ?? new Map<string, number>();
      const day = r.created_at.slice(0, 10);
      s.set(day, (s.get(day) ?? 0) + r.amount_paid_cents);
      series.set(c, s);
    }

    return {
      period,
      hasAnyActivity: rows.length > 0 || views.length > 0 || shopViews.length > 0,
      kpis,
      donuts: { visits: visitsDonut, buyers: buyersDonut, products: productsDonut },
      topProducts,
      revenueSeries: [...series.entries()].map(([currency, s]) => ({
        currency,
        days: [...s.entries()].map(([day, revenueCents]) => ({ day, revenueCents })).sort((a, b) => a.day.localeCompare(b.day)),
      })),
    };
  });
