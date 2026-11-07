import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isSellersFile, sameOwner } from "@/lib/owned-storage";

type Admin = SupabaseClient<Database>;

export type DeliverableFile = {
  id: string;
  product_id: string;
  file_name: string | null;
  storage_file_path: string;
  size_bytes: number | null;
};

// The files a buyer of these products receives. A product_files row is written
// by a seller and the database only checks that the row is theirs, so a row on
// someone else's product — or one pointing into someone else's folder — is
// dropped here (owned-storage.ts).
export async function deliverableFiles(admin: Admin, productIds: string[]): Promise<DeliverableFile[]> {
  if (productIds.length === 0) return [];
  const [{ data: owners, error: ownersError }, { data: files, error: filesError }] = await Promise.all([
    admin.from("products").select("id, owner_id").in("id", productIds),
    admin.from("product_files").select("id, product_id, owner_id, file_name, storage_file_path, size_bytes").in("product_id", productIds),
  ]);
  if (ownersError) throw new Error(ownersError.message);
  if (filesError) throw new Error(filesError.message);
  const ownerOf = new Map((owners ?? []).map((p) => [p.id, p.owner_id]));
  return (files ?? [])
    .filter((f) => isSellersFile(f, ownerOf.get(f.product_id)))
    .map(({ id, product_id, file_name, storage_file_path, size_bytes }) => ({ id, product_id, file_name, storage_file_path, size_bytes }));
}

export type DeliverableLink = { id: string; product_id: string; url: string; label: string | null };

// The links a buyer of these products receives (migration 0033), under the
// same ownership rule as files. Before that migration the table doesn't exist
// and this is simply empty, so delivery works exactly as it did.
export async function deliverableLinks(admin: Admin, productIds: string[]): Promise<DeliverableLink[]> {
  if (productIds.length === 0) return [];
  try {
    const [{ data: owners }, { data: links, error }] = await Promise.all([
      admin.from("products").select("id, owner_id").in("id", productIds),
      admin.from("product_links").select("id, product_id, owner_id, url, label").in("product_id", productIds),
    ]);
    if (error) return [];
    const ownerOf = new Map((owners ?? []).map((p) => [p.id, p.owner_id]));
    return (links ?? [])
      .filter((l) => sameOwner(l.owner_id, ownerOf.get(l.product_id)))
      .map(({ id, product_id, url, label }) => ({ id, product_id, url, label }));
  } catch {
    return [];
  }
}

// Every product id whose files a buyer of `productId` is entitled to: the
// product itself, plus anything bundled into it.
//
// Deliberately try-caught and always inclusive of the product itself, so if
// migration 0011 hasn't been applied (or the query fails) this degrades to
// exactly the pre-bundle behaviour rather than breaking delivery — which is the
// one path that must never break, because the buyer has already paid.
//
// Only the bundle seller's OWN products count as bundled in. That's checked
// here, not just when the bundle is made in the dashboard: a bundle_items row
// written straight through the API skips the app, and without this check a
// free "bundle" could hand out any other seller's paid product.
export async function resolveDeliverableProductIds(admin: Admin, productId: string): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from("bundle_items")
      .select("item_product_id, owner_id")
      .eq("bundle_product_id", productId);
    if (error || !data || data.length === 0) return [productId];
    const { data: products } = await admin
      .from("products")
      .select("id, owner_id")
      .in("id", [productId, ...data.map((row) => row.item_product_id)]);
    const ownerOf = new Map((products ?? []).map((p) => [p.id, p.owner_id]));
    const seller = ownerOf.get(productId);
    const items = data
      .filter((row) => sameOwner(row.owner_id, seller) && sameOwner(ownerOf.get(row.item_product_id), seller))
      .map((row) => row.item_product_id);
    return Array.from(new Set([productId, ...items]));
  } catch {
    return [productId];
  }
}

// Total bytes a buyer of `productId` receives, counting bundled products, plus
// any `extraProductIds` about to be bundled in.
export async function deliverableBytes(client: Admin, productId: string, extraProductIds: string[] = []): Promise<number> {
  const ids = Array.from(new Set([...(await resolveDeliverableProductIds(client, productId)), ...extraProductIds]));
  const files = await deliverableFiles(client, ids);
  return files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
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

// How many files and links a purchase of this product would actually deliver,
// counting bundled products. Used to refuse a checkout that would hand over
// nothing — a product whose only deliverable is a link is sellable too.
export async function countDeliverableFiles(admin: Admin, productId: string): Promise<number> {
  const ids = await resolveDeliverableProductIds(admin, productId);
  const [files, links] = await Promise.all([deliverableFiles(admin, ids), deliverableLinks(admin, ids)]);
  return files.length + links.length;
}
