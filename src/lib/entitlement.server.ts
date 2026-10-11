import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveDeliverableProductIds } from "@/lib/bundle.server";
import { accessForSubscriptionRow } from "@/lib/recurring.server";

type Admin = SupabaseClient<Database>;

export type EntitledFile = {
  id: string;
  file_name: string | null;
  storage_file_path: string;
  size_bytes: number | null;
};

// The single answer to "what may this purchase access?", shared by the
// download page and the online reader so the two can never disagree.
//
// A purchase qualifies only while it is a completed, non-refunded,
// non-disputed sale — refunds and chargebacks revoke access with no extra
// bookkeeping. Entitlement covers the product, anything bundled into it, and
// an order bump if one was taken. The bump lookup is defensive so delivery
// still works if migration 0012 isn't applied.
//
// null = this purchase can't be verified (wrong id, unpaid, refunded, disputed).
export async function resolveEntitledFiles(
  admin: Admin,
  transactionId: string,
): Promise<{ transaction: { id: string; seller_id: string | null }; files: EntitledFile[] } | null> {
  // select("*") so buyer_subscription_id (migration 0020) comes through when present.
  const { data: transaction, error } = await admin.from("transactions").select("*").eq("id", transactionId).single();
  if (error || !transaction || transaction.status !== "success" || transaction.refunded_at || transaction.disputed_at) {
    return null;
  }

  // Memberships and payment plans: access follows the subscription (7-day
  // grace after a failed payment; a finished plan is owned outright).
  if (transaction.buyer_subscription_id) {
    const access = await accessForSubscriptionRow(admin, transaction.buyer_subscription_id);
    if (access && !access.access) {
      throw new Error(
        access.state === "suspended"
          ? "Access is paused because a payment didn't go through. Update your card from the billing link in your email to restore it."
          : "This membership has ended.",
      );
    }
  }

  const deliverableIds = new Set(await resolveDeliverableProductIds(admin, transaction.product_id));
  try {
    const { data: bump } = await admin
      .from("transaction_bumps")
      .select("bump_product_id")
      .eq("transaction_id", transaction.id)
      .maybeSingle();
    if (bump) {
      for (const id of await resolveDeliverableProductIds(admin, bump.bump_product_id)) deliverableIds.add(id);
    }
  } catch {
    // No bump table yet — the base product's files, as before.
  }

  const { data: files, error: filesError } = await admin
    .from("product_files")
    .select("id, file_name, storage_file_path, size_bytes")
    .in("product_id", Array.from(deliverableIds));
  if (filesError) throw new Error(filesError.message);

  return { transaction: { id: transaction.id, seller_id: transaction.seller_id }, files: files ?? [] };
}
