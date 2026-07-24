import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { productImageUrl } from "@/lib/public-image-url";

export const DISCOVER_SORTS = ["trending", "best-selling", "newest"] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const listDiscover = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        search: z.string().trim().max(100).optional(),
        category: z.string().trim().max(60).optional(),
        sort: z.enum(DISCOVER_SORTS).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("products")
      .select("id, name, description, price_cents, pay_what_you_want, url_slug, category, image_url, created_at")
      .not("url_slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.category) query = query.eq("category", data.category);
    if (data.search) query = query.or(`name.ilike.%${data.search}%,description.ilike.%${data.search}%`);

    const { data: products, error } = await query;
    if (error) throw new Error(error.message);

    const rows = products ?? [];
    const sort: DiscoverSort = data.sort ?? "trending";

    // Sales counts drive both trending and best-selling. Newest-first alone
    // meant a marketplace where nothing good ever surfaced — the newest upload
    // outranked a product that had sold a hundred times.
    const salesTotal = new Map<string, number>();
    const salesRecent = new Map<string, number>();
    if (rows.length > 0 && sort !== "newest") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sales } = await supabaseAdmin
        .from("transactions")
        .select("product_id, created_at")
        .eq("status", "success")
        .in(
          "product_id",
          rows.map((r) => r.id),
        );
      for (const sale of sales ?? []) {
        salesTotal.set(sale.product_id, (salesTotal.get(sale.product_id) ?? 0) + 1);
        if (sale.created_at >= since) {
          salesRecent.set(sale.product_id, (salesRecent.get(sale.product_id) ?? 0) + 1);
        }
      }
    }

    const ranked = [...rows];
    if (sort === "best-selling") {
      ranked.sort((a, b) => (salesTotal.get(b.id) ?? 0) - (salesTotal.get(a.id) ?? 0));
    } else if (sort === "trending") {
      // Recent sales first, then all-time, then recency — so a brand-new
      // product with no history still has a path onto the page instead of
      // being buried forever behind established sellers.
      ranked.sort((a, b) => {
        const recent = (salesRecent.get(b.id) ?? 0) - (salesRecent.get(a.id) ?? 0);
        if (recent !== 0) return recent;
        const total = (salesTotal.get(b.id) ?? 0) - (salesTotal.get(a.id) ?? 0);
        if (total !== 0) return total;
        return b.created_at.localeCompare(a.created_at);
      });
    }

    return ranked.slice(0, 60).map((p) => ({
      ...p,
      imageUrl: productImageUrl(p.id, p.image_url),
      salesCount: salesTotal.get(p.id) ?? 0,
    }));
  });

// Powers the category filter chips — only categories actually in use, not a
// hardcoded list that could drift from what sellers are really picking.
export const listDiscoverCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("category")
    .not("url_slug", "is", null)
    .not("category", "is", null);
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((p) => p.category).filter((c): c is string => !!c))).sort();
});
