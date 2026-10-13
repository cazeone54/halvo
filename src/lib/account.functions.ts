import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ANONYMISED_EMAIL,
  blockDeletionReason,
  isDeleteConfirmed,
  LIVE_SUBSCRIPTION_STATUSES,
  planProductDisposal,
  type AccountStatus,
  type ProductDisposalInput,
} from "@/lib/account-closure";

/** The caller's own email, from the verified token claims — never the client's word for it. */
function callerEmail(claims: Record<string, unknown>): string | null {
  const email = claims.email;
  return typeof email === "string" && email.includes("@") ? email.toLowerCase() : null;
}

type Admin = SupabaseClient<Database>;

/**
 * Subscriptions still billing, counted both ways. Best-effort: migration 0020
 * may not be applied, and a missing table means there are none.
 */
async function countLiveSubscriptions(
  client: Admin,
  userId: string,
  email: string | null,
): Promise<{ asSeller: number; asBuyer: number }> {
  try {
    const live = [...LIVE_SUBSCRIPTION_STATUSES];
    const base = () =>
      client.from("buyer_subscriptions").select("id").is("ended_at", null).in("status", live);

    // As a buyer they may have bought before ever having an account, so the
    // row can be tied to them by id or by email. Two queries unioned by id
    // rather than one `.or()` — an email is interpolated text, and PostgREST's
    // or() syntax is a filter language a stray comma can rewrite.
    const [sellerRes, byIdRes, byEmailRes] = await Promise.all([
      base().eq("seller_id", userId),
      base().eq("buyer_id", userId),
      email ? base().eq("buyer_email", email) : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    const buyerIds = new Set([
      ...(byIdRes.data ?? []).map((r) => r.id),
      ...(byEmailRes.data ?? []).map((r) => r.id),
    ]);

    return { asSeller: (sellerRes.data ?? []).length, asBuyer: buyerIds.size };
  } catch {
    return { asSeller: 0, asBuyer: 0 };
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Everything the settings UI needs to tell the truth about what closing this
 * particular account would do. Counts only — nothing that isn't already the
 * caller's own data.
 */
export const getMyAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountStatus> => {
    const { supabase, userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profileRes, productsRes, salesRes, purchasesRes, subs] = await Promise.all([
      supabase.from("profiles").select("deactivated_at, stripe_connect_id").eq("id", userId).single(),
      supabase.from("products").select("id, url_slug").eq("owner_id", userId),
      supabase.from("transactions").select("product_id").eq("seller_id", userId),
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("buyer_id", userId),
      countLiveSubscriptions(supabaseAdmin, userId, callerEmail(claims)),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);

    const products = productsRes.data ?? [];
    const sales = salesRes.data ?? [];

    // Which of their products have ever sold — that decides kept-vs-deleted,
    // so the UI must count it exactly the way the deletion does.
    const soldProductIds = new Set(sales.map((s) => s.product_id).filter((id): id is string => !!id));

    return {
      deactivatedAt: profileRes.data.deactivated_at,
      productCount: products.length,
      publishedCount: products.filter((p) => p.url_slug !== null).length,
      soldProductCount: products.filter((p) => soldProductIds.has(p.id)).length,
      salesCount: sales.length,
      purchaseCount: purchasesRes.count ?? 0,
      hasStripeAccount: !!profileRes.data.stripe_connect_id,
      liveSubscriptionsAsSeller: subs.asSeller,
      liveSubscriptionsAsBuyer: subs.asBuyer,
    };
  });

// ---------------------------------------------------------------------------
// Deactivate / reactivate
// ---------------------------------------------------------------------------

export const deactivateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactivateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ deactivated_at: null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Permanent. Ordered so an interruption at any point leaves the account more
 * closed, never half-open:
 *
 *   1. take everything off sale          (worst case: unsellable but recoverable)
 *   2. scrub the PII that no cascade reaches
 *   3. delete what nobody bought
 *   4. delete the auth user              (irreversible; cascades the rest)
 *
 * Step 4 is last because until then the user still exists and a retry is
 * possible. Doing it first would leave published products with no owner —
 * the one state that can take money nobody is able to deliver.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ confirm: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!isDeleteConfirmed(data.confirm)) {
      throw new Error("Type the confirmation phrase exactly as shown to delete your account.");
    }

    const { userId, claims } = context;
    const email = callerEmail(claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Re-read with the admin client: what gets kept must not depend on what
    // RLS happens to show this session.
    const [productsRes, salesRes, profileRes, subs] = await Promise.all([
      supabaseAdmin.from("products").select("id, image_url, gallery_paths").eq("owner_id", userId),
      supabaseAdmin.from("transactions").select("product_id").eq("seller_id", userId),
      supabaseAdmin.from("profiles").select("avatar_url, stripe_connect_id, deactivated_at").eq("id", userId).single(),
      countLiveSubscriptions(supabaseAdmin, userId, email),
    ]);
    if (productsRes.error) throw new Error(productsRes.error.message);

    const products = productsRes.data ?? [];
    const soldProductIds = new Set(
      (salesRes.data ?? []).map((s) => s.product_id).filter((id): id is string => !!id),
    );

    // Re-checked server-side at the moment of deletion, not just when the page
    // was rendered — a membership could have started since.
    const blocked = blockDeletionReason({
      deactivatedAt: profileRes.data?.deactivated_at ?? null,
      productCount: products.length,
      publishedCount: 0,
      soldProductCount: products.filter((p) => soldProductIds.has(p.id)).length,
      salesCount: (salesRes.data ?? []).length,
      purchaseCount: 0,
      hasStripeAccount: !!profileRes.data?.stripe_connect_id,
      liveSubscriptionsAsSeller: subs.asSeller,
      liveSubscriptionsAsBuyer: subs.asBuyer,
    });
    if (blocked) throw new Error(blocked);

    // Storage paths per product, so a removed product takes its files with it
    // and a kept product keeps them.
    const fileRes = await supabaseAdmin
      .from("product_files")
      .select("product_id, storage_file_path")
      .eq("owner_id", userId);

    const pathsByProduct = new Map<string, string[]>();
    for (const file of fileRes.data ?? []) {
      const list = pathsByProduct.get(file.product_id) ?? [];
      list.push(file.storage_file_path);
      pathsByProduct.set(file.product_id, list);
    }

    const disposalInput: ProductDisposalInput[] = products.map((p) => ({
      id: p.id,
      hasSales: soldProductIds.has(p.id),
      storagePaths: [
        ...(pathsByProduct.get(p.id) ?? []),
        ...(p.image_url ? [p.image_url] : []),
        ...((p.gallery_paths as string[] | null) ?? []),
      ],
    }));

    const plan = planProductDisposal(disposalInput);

    // --- 1. Off sale, before anything else -----------------------------------
    // Clearing url_slug is the same "draft" state a product has before its
    // first publish, and it's what every public read path already filters on,
    // so this alone makes them unreachable and unbuyable.
    if (plan.unpublish.length > 0) {
      const { error } = await supabaseAdmin.from("products").update({ url_slug: null }).in("id", plan.unpublish);
      if (error) throw new Error(error.message);
    }

    // --- 2. The PII no cascade reaches ---------------------------------------
    // Rows keyed by email text rather than by a foreign key survive the user
    // delete untouched, so they're cleared by hand. Everything keyed by
    // seller_id/buyer_id with ON DELETE CASCADE is left to the cascade.
    //
    // Best-effort: a failure here must not abort a deletion the user asked for.
    const scrub: PromiseLike<unknown>[] = [
      // Their buyer identity on purchases they made. The transaction row is
      // kept — tax, and the seller's own revenue record — but stops naming them.
      supabaseAdmin.from("transactions").update({ buyer_email: ANONYMISED_EMAIL }).eq("buyer_id", userId),
    ];

    if (email) {
      scrub.push(
        // Reviews they wrote stay as anonymous ratings: the seller keeps the
        // social proof, the buyer stops being identifiable.
        supabaseAdmin.from("reviews").update({ buyer_email: ANONYMISED_EMAIL }).eq("buyer_email", email),
        // Transactions where they bought before ever having an account, so
        // buyer_id is null and only the email ties the row to them.
        supabaseAdmin.from("transactions").update({ buyer_email: ANONYMISED_EMAIL }).eq("buyer_email", email),
        // Their address on other sellers' mailing lists. Rows where THEY are
        // the seller go with the cascade.
        supabaseAdmin.from("broadcast_unsubscribes").delete().eq("email", email),
      );
    }

    await Promise.allSettled(scrub);

    // --- 3. Delete what nobody bought ---------------------------------------
    if (plan.remove.length > 0) {
      const { error } = await supabaseAdmin.from("products").delete().in("id", plan.remove);
      if (error) throw new Error(error.message);
    }

    const storagePaths = [
      ...plan.storagePathsToDelete,
      ...(profileRes.data?.avatar_url ? [profileRes.data.avatar_url] : []),
    ];
    if (storagePaths.length > 0) {
      // Best-effort: the nightly orphan sweep catches anything missed, and a
      // storage hiccup must not leave the account half-deleted.
      await supabaseAdmin.storage.from("digital-assets").remove(storagePaths);
    }

    // --- 4. The user itself --------------------------------------------------
    // Cascades: profiles, subscriptions, coupons, referral_codes, commissions,
    // ai_generations, bundle_items, product_bumps, broadcasts,
    // broadcast_unsubscribes. Sets null: products.owner_id,
    // product_files.owner_id (migration 0022 — so buyers keep their
    // downloads), transactions.seller_id/buyer_id, download_events.seller_id,
    // sale_sources.seller_id, buyer_subscriptions.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(`Couldn't delete the account: ${deleteError.message}`);

    return { ok: true, productsRemoved: plan.remove.length, productsKept: plan.unpublish.length };
  });
