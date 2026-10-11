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

// Total bytes a buyer of `productId` receives, counting bundled products, plus
// any `extraProductIds` about to be bundled in.
export async function deliverableBytes(client: Admin, productId: string, extraProductIds: string[] = []): Promise<number> {
  const ids = Array.from(new Set([...(await resolveDeliverableProductIds(client, productId)), ...extraProductIds]));
  const { data } = await client.from("product_files").select("size_bytes").in("product_id", ids);
  return (data ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
}

// Free bundles that include `productId` — a file added to it reaches their
// buyers too. Best-effort like the resolver above: no bundles table, no bundles.
export async function freeBundlesContaining(client: Admin, productId: string): Promise<string[]> {
  try {
    const { data: rows } = await client.from("bundle_items").select("bundle_product_id").eq("item_product_id", productId);
    const ids = (rows ?? []).map((r) => r.bundle_product_id);
    if (ids.length === 0) return [];
    const { data: bundles } = await client
      .from("products")
      .select("id, price_cents, pay_what_you_want")
      .in("id", ids);
    return (bundles ?? []).filter((b) => !b.pay_what_you_want && b.price_cents === 0).map((b) => b.id);
  } catch {
    return [];
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
