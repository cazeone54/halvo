import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * The sellers currently deactivated, so public listings can leave them out.
 *
 * Deactivation deliberately doesn't touch products — their slugs, and so their
 * URLs and search rankings, survive it intact. The cost of that choice is that
 * `url_slug is not null` no longer means "buyable", and every public surface
 * has to exclude these ids as well.
 *
 * Read on each call rather than cached: a seller who reactivates expects their
 * shop back immediately, and the partial index in migration 0022 makes this
 * proportional to the number of deactivated accounts rather than to the user
 * table.
 *
 * Best-effort by design — if migration 0022 hasn't been applied the column
 * doesn't exist, and an empty set means the listing behaves exactly as it did
 * before the feature existed.
 */
export async function deactivatedSellerIds(admin: Admin): Promise<Set<string>> {
  try {
    const { data, error } = await admin.from("profiles").select("id").not("deactivated_at", "is", null);
    if (error) return new Set();
    return new Set((data ?? []).map((row) => row.id));
  } catch {
    return new Set();
  }
}

/**
 * Whether a row owned by `ownerId` should appear in a public listing.
 *
 * One definition for all three call sites (discover, its category chips, and
 * the sitemap) because the awkward case is easy to get backwards: an owner_id
 * of null means the seller's account was DELETED, and those products are
 * already unpublished, so they're visible as far as this rule is concerned.
 * Only a currently-deactivated owner hides a row.
 */
export function isSellerVisible(ownerId: string | null, deactivated: Set<string>): boolean {
  return !ownerId || !deactivated.has(ownerId);
}
