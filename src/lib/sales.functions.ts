import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMySales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, buyer_email, amount_paid_cents, status, created_at, products(name)")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      id: t.id,
      buyerEmail: t.buyer_email,
      amountPaidCents: t.amount_paid_cents,
      status: t.status,
      createdAt: t.created_at,
      productName: (t.products as unknown as { name: string } | null)?.name ?? "Unknown product",
    }));
  });
