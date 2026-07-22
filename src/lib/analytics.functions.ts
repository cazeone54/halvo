import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const topProducts = Array.from(byProduct.values()).sort((a, b) => b.revenueCents - a.revenueCents);

    const last30Days = new Map<string, number>();
    const now = Date.now();
    for (const r of successful) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      const ageMs = now - new Date(r.created_at).getTime();
      if (ageMs > 30 * 24 * 60 * 60 * 1000) continue;
      last30Days.set(day, (last30Days.get(day) ?? 0) + r.amount_paid_cents);
    }

    return {
      totalRevenueCents,
      totalSales,
      topProducts,
      dailyRevenue: Array.from(last30Days.entries())
        .map(([day, revenueCents]) => ({ day, revenueCents }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  });
