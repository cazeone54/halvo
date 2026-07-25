import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A seller's customer list — the audience they own, which is the single
// strongest reason not to churn off the platform. Built entirely from existing
// transactions (RLS restricts to the seller's own rows), so it needs no new
// table and no new data collection: buyers already give their email at checkout
// for delivery.
export const getMyCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("buyer_email, amount_paid_cents, status, created_at, products(name)")
      .eq("seller_id", context.userId)
      .eq("status", "success")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const byEmail = new Map<
      string,
      { email: string; orders: number; totalCents: number; lastAt: string; firstAt: string; lastProduct: string }
    >();

    for (const row of data ?? []) {
      const email = row.buyer_email;
      const productName = (row.products as unknown as { name: string } | null)?.name ?? "";
      const existing = byEmail.get(email);
      if (existing) {
        existing.orders += 1;
        existing.totalCents += row.amount_paid_cents;
        // rows are newest-first, so the first time we see an email is its most
        // recent order; keep the earliest seen as firstAt.
        if (row.created_at < existing.firstAt) existing.firstAt = row.created_at;
      } else {
        byEmail.set(email, {
          email,
          orders: 1,
          totalCents: row.amount_paid_cents,
          lastAt: row.created_at,
          firstAt: row.created_at,
          lastProduct: productName,
        });
      }
    }

    return Array.from(byEmail.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  });
