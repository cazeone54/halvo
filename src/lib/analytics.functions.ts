import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mergeSourceStats, type SourceStat } from "@/lib/source-stats";

export const getMyAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("transactions")
      .select("amount_paid_cents, status, product_id, created_at, products(name)")
      .eq("seller_id", context.userId);
    if (error) throw new Error(error.message);

    const successful = (rows ?? []).filter((r) => r.status === "success");
    const totalRevenueCents = successful.reduce((sum, r) => sum + r.amount_paid_cents, 0);
    const totalSales = successful.length;

    const byProduct = new Map<string, { name: string; revenueCents: number; sales: number }>();
    for (const r of successful) {
      const name = (r.products as unknown as { name: string } | null)?.name ?? "Unknown product";
      const entry = byProduct.get(r.product_id) ?? { name, revenueCents: 0, sales: 0 };
      entry.revenueCents += r.amount_paid_cents;
      entry.sales += 1;
      byProduct.set(r.product_id, entry);
    }

    // Page views → conversion rate. Read defensively and separately so the
    // whole analytics page still works if migration 0013 hasn't been applied
    // (the seller just sees no view data). RLS on product_views scopes this to
    // the seller's own products, so no seller filter is needed here.
    let totalViews = 0;
    const viewsByProduct = new Map<string, number>();
    const viewSources: Array<string | null> = [];
    try {
      // `source` arrives with migration 0023; select it separately from the
      // count so an unmigrated database still yields views (just unattributed).
      let views: Array<{ product_id: string; source?: string | null }> | null = null;
      const withSource = await context.supabase.from("product_views").select("product_id, source");
      if (withSource.error) {
        const fallback = await context.supabase.from("product_views").select("product_id");
        views = fallback.data;
      } else {
        views = withSource.data;
      }

      for (const v of views ?? []) {
        totalViews += 1;
        viewsByProduct.set(v.product_id, (viewsByProduct.get(v.product_id) ?? 0) + 1);
        viewSources.push(v.source ?? null);
      }
    } catch {
      // Views are a nice-to-have; never fail the whole analytics page for them.
    }

    const topProducts = Array.from(byProduct.entries())
      .map(([id, entry]) => ({ ...entry, views: viewsByProduct.get(id) ?? 0 }))
      .sort((a, b) => b.revenueCents - a.revenueCents);

    const last30Days = new Map<string, number>();
    const now = Date.now();
    for (const r of successful) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      const ageMs = now - new Date(r.created_at).getTime();
      if (ageMs > 30 * 24 * 60 * 60 * 1000) continue;
      last30Days.set(day, (last30Days.get(day) ?? 0) + r.amount_paid_cents);
    }

    // Where traffic AND sales came from, per channel, so the page can show
    // conversion per source. Read separately and defensively so the rest of the
    // analytics page still works if migration 0009 hasn't been applied.
    let topSources: SourceStat[] = [];
    try {
      const { data: sources } = await context.supabase
        .from("sale_sources")
        .select("source")
        .eq("seller_id", context.userId);
      topSources = mergeSourceStats(
        viewSources,
        (sources ?? []).map((row) => row.source),
      );
    } catch {
      // Sale sources unavailable — still report traffic by channel on its own.
      topSources = mergeSourceStats(viewSources, []);
    }

    return {
      totalRevenueCents,
      totalSales,
      totalViews,
      topProducts,
      topSources,
      dailyRevenue: Array.from(last30Days.entries())
        .map(([day, revenueCents]) => ({ day, revenueCents }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  });
