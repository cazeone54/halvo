import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

// Every product id whose files a buyer of `productId` is entitled to: the
// product itself, plus anything bundled into it.
//
// Deliberately try-caught and always inclusive of the product itself, so if
// migration 0011 hasn't been applied (or the query fails) this degrades to
// exactly the pre-bundle behaviour rather than breaking delivery — which is the
// one path that must never break, because the buyer has already paid.
export async function resolveDeliverableProductIds(admin: Admin, productId: string): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from("bundle_items")
      .select("item_product_id")
      .eq("bundle_product_id", productId);
    if (error || !data || data.length === 0) return [productId];
    return Array.from(new Set([productId, ...data.map((row) => row.item_product_id)]));
  } catch {
    return [productId];
  }
}

// How many files a purchase of this product would actually deliver, counting
// bundled products. Used to refuse a checkout that would hand over nothing.
export async function countDeliverableFiles(admin: Admin, productId: string): Promise<number> {
  const ids = await resolveDeliverableProductIds(admin, productId);
  const { count } = await admin
    .from("product_files")
    .select("id", { count: "exact", head: true })
    .in("product_id", ids);
  return count ?? 0;
}
