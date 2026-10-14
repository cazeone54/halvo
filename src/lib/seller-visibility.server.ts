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

/**
 * The sellers whose connected Stripe account can take payments right now
 * (profiles.stripe_charges_enabled, kept in step by the dashboard's Stripe
 * status check and the account.updated webhook).
 *
 * null means unknown: migration 0024 isn't applied or the read failed. Callers
 * then behave as before this rule existed, rather than hiding the whole site.
 */
export async function chargeReadySellerIds(admin: Admin): Promise<Set<string> | null> {
  try {
    const { data, error } = await admin.from("profiles").select("id").eq("stripe_charges_enabled", true);
    if (error) return null;
    return new Set((data ?? []).map((row) => row.id));
  } catch {
    return null;
  }
}

/** The same for one seller: true or false, or null when unknown. */
export async function sellerCanTakePayments(admin: Admin, sellerId: string): Promise<boolean | null> {
  try {
    const { data, error } = await admin
      .from("profiles")
      .select("stripe_charges_enabled")
      .eq("id", sellerId)
      .maybeSingle();
    if (error || !data) return null;
    return data.stripe_charges_enabled === true;
  } catch {
    return null;
  }
}

export type ListingVisibility = { deactivated: Set<string>; chargeReady: Set<string> | null };

export async function loadListingVisibility(admin: Admin): Promise<ListingVisibility> {
  const [deactivated, chargeReady] = await Promise.all([deactivatedSellerIds(admin), chargeReadySellerIds(admin)]);
  return { deactivated, chargeReady };
}

/**
 * Whether a product shows where buyers browse: Discover, its category chips and
 * the sitemap. Only sellers who can take payments are listed there, free
 * products included. A seller who hasn't connected Stripe hasn't been verified
 * by anyone, and Discover is for shops that are open.
 */
export function isListedPublicly(product: { owner_id: string | null }, visibility: ListingVisibility): boolean {
  if (!isSellerVisible(product.owner_id, visibility.deactivated)) return false;
  if (!product.owner_id || visibility.chargeReady === null) return true;
  return visibility.chargeReady.has(product.owner_id);
}

/**
 * Whether a product's own page, and its place on the seller's storefront, can
 * be opened. A paid product whose seller can't take payments yet is hidden: its
 * page could only tell buyers it isn't available. A free product works without
 * Stripe, so it stays reachable by its link (a lead magnet shared from a bio).
 * `sellerCanPay` null means unknown, which keeps the previous behaviour.
 */
export function isReachableByLink(
  product: { price_cents: number; pay_what_you_want: boolean | null },
  sellerCanPay: boolean | null,
): boolean {
  if (sellerCanPay !== false) return true;
  return !product.pay_what_you_want && product.price_cents === 0;
}
