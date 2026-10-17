import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addTo, asCurrency, totalsWeight, type Currency, type MoneyTotals } from "@/lib/currency";

export const getMyAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("transactions")
      .select("amount_paid_cents, currency, status, product_id, created_at, products(name)")
      .eq("seller_id", context.userId);
    if (error) throw new Error(error.message);

    const successful = (rows ?? []).filter((r) => r.status === "success");
    // Revenue is kept per currency: euro and dollar sales are never added together.
    const totalRevenue: MoneyTotals = {};
    for (const r of successful) addTo(totalRevenue, r.currency, r.amount_paid_cents);
    const totalSales = successful.length;

    const byProduct = new Map<string, { name: string; revenue: MoneyTotals; sales: number }>();
    for (const r of successful) {
      const name = (r.products as unknown as { name: string } | null)?.name ?? "Unknown product";
      const entry = byProduct.get(r.product_id) ?? { name, revenue: {}, sales: 0 };
      addTo(entry.revenue, r.currency, r.amount_paid_cents);
      entry.sales += 1;
      byProduct.set(r.product_id, entry);
    }

    // Page views → conversion rate. Read defensively so the whole analytics
    // page still works if migration 0013 hasn't been applied (the seller just
    // sees no view data). RLS on product_views scopes this to the seller's own
    // products, so no seller filter is needed here.
    //
    // Where each view came from is still recorded (product_views.source, and
    // sale_sources per sale) — it just isn't reported yet. The breakdown was
    // removed from the page on 2026-10-17 because with almost no traffic every
    // row read "Unknown"/"Direct" with no sales, which says nothing. The data
    // keeps accruing so it can be shown later with real history behind it;
    // mergeSourceStats in source-stats.ts still does the maths.
    let totalViews = 0;
    const viewsByProduct = new Map<string, number>();
    try {
      const { data: views } = await context.supabase.from("product_views").select("product_id");
      for (const v of views ?? []) {
        totalViews += 1;
        viewsByProduct.set(v.product_id, (viewsByProduct.get(v.product_id) ?? 0) + 1);
      }
    } catch {
      // Views are a nice-to-have; never fail the whole analytics page for them.
    }

    const topProducts = Array.from(byProduct.entries())
      .map(([id, entry]) => ({ ...entry, views: viewsByProduct.get(id) ?? 0 }))
      .sort((a, b) => totalsWeight(b.revenue) - totalsWeight(a.revenue));

    // One series per currency, so each chart's bars are a single real amount.
    const last30Days = new Map<Currency, Map<string, number>>();
    const now = Date.now();
    for (const r of successful) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      const ageMs = now - new Date(r.created_at).getTime();
      if (ageMs > 30 * 24 * 60 * 60 * 1000) continue;
      const currency = asCurrency(r.currency);
      const series = last30Days.get(currency) ?? new Map<string, number>();
      series.set(day, (series.get(day) ?? 0) + r.amount_paid_cents);
      last30Days.set(currency, series);
    }

    return {
      totalRevenue,
      totalSales,
      totalViews,
      topProducts,
      dailyRevenue: Array.from(last30Days.entries()).map(([currency, series]) => ({
        currency,
        days: Array.from(series.entries())
          .map(([day, revenueCents]) => ({ day, revenueCents }))
          .sort((a, b) => a.day.localeCompare(b.day)),
      })),
    };
  });
