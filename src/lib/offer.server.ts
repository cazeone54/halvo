import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { stockRemaining } from "@/lib/offer";

export const SOLD_OUT_MESSAGE = "Sold out — every copy has been claimed.";

// New sales only — membership renewals and later installments aren't another copy sold.
export async function countSuccessfulSales(admin: SupabaseClient<Database>, productId: string): Promise<number> {
  const query = () =>
    admin.from("transactions").select("id", { count: "exact", head: true }).eq("product_id", productId).eq("status", "success");
  const { count, error } = await query().eq("is_renewal", false);
  if (!error) return count ?? 0;
  // is_renewal arrives with migration 0020; before that every sale is a new sale.
  return (await query()).count ?? 0;
}

// Checked when a payment is created, so a sold-out product can't be paid for.
// Two buyers racing for the very last copy can both get through — a slight
// oversell is the right failure mode for digital goods, versus charging and refusing.
export async function assertInStock(
  admin: SupabaseClient<Database>,
  product: { id: string; stock_limit?: number | null },
): Promise<void> {
  if (product.stock_limit == null) return;
  const remaining = stockRemaining(product.stock_limit, await countSuccessfulSales(admin, product.id));
  if (remaining === 0) throw new Error(SOLD_OUT_MESSAGE);
}
