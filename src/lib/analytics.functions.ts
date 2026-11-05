import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPeriod, type Period } from "@/lib/analytics-math";
import { buildAnalyticsReport } from "@/lib/analytics-report";
import { bioLinksForDisplay } from "@/lib/link-in-bio";

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
  .validator((data) =>
    z.object({ period: z.number().optional(), product: z.string().uuid().optional() }).optional().parse(data),
  )
  .handler(async ({ data, context }) => {
    const period: Period = isPeriod(data?.period) ? (data!.period as Period) : 30;
    const db = context.supabase;
    const me = context.userId;

    const [salesRes, productsRes] = await Promise.all([
      readAll((from, to) =>
        db
          .from("transactions")
          .select("id, amount_paid_cents, currency, status, refunded_at, product_id, created_at")
          .eq("seller_id", me)
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) => db.from("products").select("id, name").eq("owner_id", me).order("id").range(from, to)),
    ]);
    if (salesRes.error) throw new Error(salesRes.error.message);
    if (productsRes.error) throw new Error(productsRes.error.message);

    // Each of these is read defensively: a missing migration costs the page
    // that one number, never the whole page. RLS scopes every read to this seller.
    const [viewsRes, shopRes, sourcesRes, membersRes, linksRes, clicksRes] = await Promise.all([
      readAll((from, to) => db.from("product_views").select("product_id, source, created_at").order("id").range(from, to)),
      db.from("shop_views").select("id", { count: "exact", head: true }).eq("seller_id", me),
      readAll((from, to) =>
        db.from("sale_sources").select("transaction_id, source").eq("seller_id", me).order("id").range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("buyer_subscriptions")
          .select("product_id, kind, status, amount_cents, currency, billing_interval, created_at, ended_at")
          .eq("seller_id", me)
          .order("id")
          .range(from, to),
      ),
      db.from("profiles").select("bio_links").eq("id", me).maybeSingle(),
      readAll((from, to) =>
        db.from("link_clicks").select("link_id, created_at").eq("profile_id", me).order("id").range(from, to),
      ),
    ]);

    return buildAnalyticsReport({
      period,
      now: new Date(),
      productId: data?.product ?? null,
      products: productsRes.data,
      sales: salesRes.data,
      views: viewsRes.error ? [] : viewsRes.data,
      saleSources: sourcesRes.error ? [] : sourcesRes.data,
      memberships: membersRes.error ? [] : membersRes.data,
      links: linksRes.error ? [] : bioLinksForDisplay(linksRes.data?.bio_links),
      clicks: clicksRes.error ? [] : clicksRes.data,
      hasShopViews: !shopRes.error && (shopRes.count ?? 0) > 0,
    });
  });
