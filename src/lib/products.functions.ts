import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { PLAN_LIMITS } from "@/lib/plans";
import { checkUploadAgainstLimits, checkFreeBundleSize, checkFreeProductSize, isFreePricing } from "@/lib/upload-limits";
import { deliverableBytes, freeBundlesContaining } from "@/lib/bundle.server";
import { productImageUrl } from "@/lib/public-image-url";
import { isOwnProductPath } from "@/lib/product-media";
import type { Database } from "@/integrations/supabase/types";

async function currentUploadUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  productId: string,
): Promise<{ currentCountForProduct: number; usedBytesAcrossAllProducts: number; usedBytesForProduct: number }> {
  const { data: files } = await supabase.from("product_files").select("product_id, size_bytes").eq("owner_id", userId);
  const all = files ?? [];
  const forProduct = all.filter((f) => f.product_id === productId);
  return {
    currentCountForProduct: forProduct.length,
    usedBytesAcrossAllProducts: all.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0),
    usedBytesForProduct: forProduct.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0),
  };
}

// A seller counts as verified once Stripe has checked their identity and enabled
// payments. Any failure reads as unverified, which only ever means smaller caps.
async function isVerifiedSeller(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase.from("profiles").select("stripe_connect_id").eq("id", userId).single();
    if (!profile?.stripe_connect_id) return false;
    const { getStripeClient } = await import("@/lib/stripe.server");
    const account = await getStripeClient().accounts.retrieve(profile.stripe_connect_id);
    return !!account.charges_enabled;
  } catch {
    return false;
  }
}

// Upload checks that depend on what a buyer of a free product receives: for a
// free product that's its own files plus anything bundled into it, and a file
// added to a product inside a free bundle reaches that bundle's buyers too.
async function freeDeliveryUsage(
  supabase: SupabaseClient<Database>,
  productId: string,
  productIsFree: boolean,
  addBytes: number,
): Promise<{ deliverableBytesForProduct: number | null; bundleRejection: string | null }> {
  const [own, bundleIds] = await Promise.all([
    productIsFree ? deliverableBytes(supabase, productId) : Promise.resolve(null),
    freeBundlesContaining(supabase, productId),
  ]);
  for (const bundleId of bundleIds) {
    const rejection = checkFreeBundleSize((await deliverableBytes(supabase, bundleId)) + addBytes);
    if (rejection) return { deliverableBytesForProduct: own, bundleRejection: rejection };
  }
  return { deliverableBytesForProduct: own, bundleRejection: null };
}

const slugify = (name: string, suffix: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)}-${suffix}`;

export const listMyProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // select("*") (rather than an explicit column list) so refund_policy comes
    // through when migration 0015 is applied and is simply absent when it isn't —
    // no query error either way. It's the seller's own rows, so nothing extra leaks.
    // Files come back with the products (one extra query for all of them),
    // so the product list doesn't fire a separate request per row.
    const [{ data, error }, { data: files }] = await Promise.all([
      context.supabase.from("products").select("*").eq("owner_id", context.userId).order("created_at", { ascending: false }),
      context.supabase
        .from("product_files")
        .select("id, product_id, file_name, storage_file_path, size_bytes")
        .eq("owner_id", context.userId),
    ]);
    if (error) throw new Error(error.message);
    const filesByProduct = new Map<string, Array<{ id: string; file_name: string | null; storage_file_path: string; size_bytes: number | null }>>();
    for (const { product_id, ...f } of files ?? []) {
      const list = filesByProduct.get(product_id) ?? [];
      list.push(f);
      filesByProduct.set(product_id, list);
    }
    return data.map((product) => ({
      ...product,
      imageUrl: productImageUrl(product.id, product.image_url),
      files: filesByProduct.get(product.id) ?? [],
    }));
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional(),
        priceCents: z.number().int().min(0),
        payWhatYouWant: z.boolean().optional(),
        category: z.string().trim().max(60).optional(),
        refundPolicy: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const tier = await resolveUserTier(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId);
    if ((count ?? 0) >= PLAN_LIMITS[tier].productsMax) {
      throw new Error(
        `You've reached the ${PLAN_LIMITS[tier].productsMax}-product limit on your current plan. Upgrade to add more.`,
      );
    }

    // Created as a draft (url_slug null) on purpose. A product only becomes
    // publicly linkable once it actually has a deliverable attached — see
    // attachProductFile. Previously a product went live the moment it was
    // created, so a seller could share a link to a product with no file and a
    // buyer would pay and receive nothing.
    const { data: product, error } = await context.supabase
      .from("products")
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        price_cents: data.priceCents,
        pay_what_you_want: data.payWhatYouWant ?? false,
        category: data.category ?? null,
        url_slug: null,
      })
      .select("id, url_slug")
      .single();
    if (error || !product) throw new Error(error?.message ?? "Could not create product");

    // Optional per-product refund policy, written separately and best-effort so
    // a not-yet-applied migration 0015 can never break product creation — any
    // error (e.g. missing column) is intentionally ignored.
    if (data.refundPolicy !== undefined) {
      await context.supabase
        .from("products")
        .update({ refund_policy: data.refundPolicy || null })
        .eq("id", product.id)
        .eq("owner_id", context.userId);
    }

    return product;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        priceCents: z.number().int().min(0).optional(),
        // The seller's own dollar price; null = the same number as the euro price.
        priceUsdCents: z.number().int().min(50, "A dollar price must be at least $0.50.").nullable().optional(),
        payWhatYouWant: z.boolean().optional(),
        category: z.string().trim().max(60).optional(),
        refundPolicy: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { productId, ...rest } = data;
    const update: Database["public"]["Tables"]["products"]["Update"] = {};
    if (rest.name !== undefined) update.name = rest.name;
    if (rest.description !== undefined) update.description = rest.description;
    if (rest.priceCents !== undefined) update.price_cents = rest.priceCents;
    if (rest.priceUsdCents !== undefined) update.price_usd_cents = rest.priceUsdCents;
    if (rest.payWhatYouWant !== undefined) update.pay_what_you_want = rest.payWhatYouWant;
    if (rest.category !== undefined) update.category = rest.category;

    // Making a product free can't be a way round the free-product size cap.
    if (rest.priceCents === 0 && rest.payWhatYouWant !== true) {
      const { data: current } = await context.supabase
        .from("products")
        .select("pay_what_you_want")
        .eq("id", productId)
        .eq("owner_id", context.userId)
        .single();
      if (current && !current.pay_what_you_want) {
        // Counts bundled products too — a bundle is free to everything in it.
        const tooBig = checkFreeProductSize(await deliverableBytes(context.supabase, productId));
        if (tooBig) throw new Error(tooBig);
      }
    }

    if (Object.keys(update).length > 0) {
      const { error } = await context.supabase
        .from("products")
        .update(update)
        .eq("id", productId)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
    }

    // Refund policy is written separately and best-effort so a missing 0015
    // migration can't break the rest of the edit — its error is ignored.
    if (rest.refundPolicy !== undefined) {
      await context.supabase
        .from("products")
        .update({ refund_policy: rest.refundPolicy || null })
        .eq("id", productId)
        .eq("owner_id", context.userId);
    }

    return { ok: true };
  });

const MAX_IMAGE_MB = 5;

// Cover images aren't gated by the per-tier downloadable-file storage limits
// (upload-limits.ts) — those are about the product's actual deliverable, not
// its marketing image. Just a flat sane size cap to prevent abuse.
export const setProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        storageFilePath: z.string().min(1),
        sizeBytes: z.number().int().positive().max(MAX_IMAGE_MB * 1024 * 1024),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // The cover is served publicly, so it must be a file from this product's
    // own folder — never another seller's (or this seller's paid) file.
    if (!isOwnProductPath(data.storageFilePath, context.userId, data.productId)) {
      throw new Error("Invalid image path");
    }
    const { data: product } = await context.supabase
      .from("products")
      .select("id, image_url")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .single();
    if (!product) {
      await context.supabase.storage.from("digital-assets").remove([data.storageFilePath]);
      throw new Error("Product not found");
    }

    const { error } = await context.supabase
      .from("products")
      .update({ image_url: data.storageFilePath })
      .eq("id", data.productId)
      .eq("owner_id", context.userId);
    if (error) {
      await context.supabase.storage.from("digital-assets").remove([data.storageFilePath]);
      throw new Error(error.message);
    }

    if (product.image_url) {
      await context.supabase.storage.from("digital-assets").remove([product.image_url]);
    }
    return { ok: true };
  });

// The actual fix: `transactions.product_id` cascades on delete, so hard-
// deleting a product with any sales would silently destroy that seller's
// own revenue records, analytics, and commission history. If the product
// has ever sold, this unpublishes it (clears url_slug, same "draft" state
// products already have before first publish) instead of deleting it —
// preserving all historical data. Only a never-sold product is actually
// removed, and its storage files are cleaned up too so nothing orphans.
export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { count: salesCount } = await context.supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.productId);

    if ((salesCount ?? 0) > 0) {
      const { error: unpublishError } = await context.supabase
        .from("products")
        .update({ url_slug: null })
        .eq("id", data.productId)
        .eq("owner_id", context.userId);
      if (unpublishError) throw new Error(unpublishError.message);
      return { ok: true, unpublishedInstead: true };
    }

    const { data: files } = await context.supabase
      .from("product_files")
      .select("storage_file_path")
      .eq("product_id", data.productId)
      .eq("owner_id", context.userId);
    const { data: media } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("products")
      .delete()
      .eq("id", data.productId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    const paths = [
      ...(files ?? []).map((f) => f.storage_file_path),
      ...(media?.image_url ? [media.image_url] : []),
      ...(media?.gallery_paths ?? []),
    ];
    if (paths.length > 0) {
      await context.supabase.storage.from("digital-assets").remove(paths);
    }
    return { ok: true };
  });

export const listMyProductFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: files, error } = await context.supabase
      .from("product_files")
      .select("id, file_name, storage_file_path, size_bytes")
      .eq("product_id", data.productId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return files;
  });

// Public products in this app don't need a pre-signed upload URL check —
// the client uploads directly to Supabase Storage (owner-prefixed path,
// allowed by RLS), so the only way to actually stop an over-limit upload is
// to check *before* the client starts sending bytes. This is that check.
export const checkCanUploadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid(), sizeBytes: z.number().int().positive() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: product } = await context.supabase
      .from("products")
      .select("price_cents, pay_what_you_want")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .single();
    if (!product) throw new Error("Product not found");
    const productIsFree = isFreePricing(product);
    const [tier, usage, verified, free] = await Promise.all([
      resolveUserTier(context.supabase, context.userId),
      currentUploadUsage(context.supabase, context.userId, data.productId),
      isVerifiedSeller(context.supabase, context.userId),
      freeDeliveryUsage(context.supabase, data.productId, productIsFree, data.sizeBytes),
    ]);
    const rejection =
      checkUploadAgainstLimits(
        {
          sizeBytes: data.sizeBytes,
          ...usage,
          usedBytesForProduct: free.deliverableBytesForProduct ?? usage.usedBytesForProduct,
          productIsFree,
          verified,
        },
        PLAN_LIMITS[tier],
      ) ?? free.bundleRejection;
    if (rejection) throw new Error(rejection);
    return { ok: true };
  });

// This is the authoritative enforcement point — it re-checks the same
// limits (in case two uploads raced past checkCanUploadFile concurrently)
// and, if rejected here, deletes the file that was already uploaded to
// Storage rather than leaving it orphaned and silently counting against
// nothing.
export const attachProductFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        storageFilePath: z.string().min(1),
        fileName: z.string().min(1),
        sizeBytes: z.number().int().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify the caller actually owns the product before attaching the file.
    const { data: product } = await context.supabase
      .from("products")
      .select("id, name, url_slug, price_cents, pay_what_you_want")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .single();
    if (!product) throw new Error("Product not found");

    const productIsFree = isFreePricing(product);
    const [tier, usage, verified, free] = await Promise.all([
      resolveUserTier(context.supabase, context.userId),
      currentUploadUsage(context.supabase, context.userId, data.productId),
      isVerifiedSeller(context.supabase, context.userId),
      freeDeliveryUsage(context.supabase, data.productId, productIsFree, data.sizeBytes),
    ]);
    const rejection =
      checkUploadAgainstLimits(
        {
          sizeBytes: data.sizeBytes,
          ...usage,
          usedBytesForProduct: free.deliverableBytesForProduct ?? usage.usedBytesForProduct,
          productIsFree,
          verified,
        },
        PLAN_LIMITS[tier],
      ) ?? free.bundleRejection;
    if (rejection) {
      await context.supabase.storage.from("digital-assets").remove([data.storageFilePath]);
      throw new Error(rejection);
    }

    const { error } = await context.supabase.from("product_files").insert({
      product_id: data.productId,
      owner_id: context.userId,
      storage_file_path: data.storageFilePath,
      file_name: data.fileName,
      size_bytes: data.sizeBytes,
    });
    if (error) throw new Error(error.message);

    // Attaching the first file is what publishes the product — that's the
    // moment it has something to actually deliver. Until now it was a draft
    // with no public URL.
    const wasDraft = product.url_slug === null;
    let urlSlug = product.url_slug;
    if (wasDraft) {
      urlSlug = slugify(product.name, Math.random().toString(36).slice(2, 8));
      const { error: publishError } = await context.supabase
        .from("products")
        .update({ url_slug: urlSlug })
        .eq("id", data.productId)
        .eq("owner_id", context.userId);
      if (publishError) throw new Error(publishError.message);
    }

    return { ok: true, published: wasDraft, urlSlug };
  });

// A seller opening one of their own uploads, to check it's the right file and
// not a half-saved draft. Deliberately not the buyer path: it never touches
// download_events, so looking at your own work neither pads your sales
// evidence nor counts against the free-delivery cap.
//
// Returns a link on this site, good for five minutes — long enough to open,
// short enough that a copied URL is useless by the time it's shared.
export const getMyProductFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ fileId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Ownership is settled here, against the caller's own client, before any
    // signing happens.
    const { data: file } = await context.supabase
      .from("product_files")
      .select("storage_file_path, file_name")
      .eq("id", data.fileId)
      .eq("owner_id", context.userId)
      .single();
    if (!file) throw new Error("File not found");

    // A ticket for /f/<token> on this site rather than the storage URL itself:
    // the seller sees our own address, and the file saves instead of opening.
    const { signFileToken } = await import("@/lib/file-token");
    const { unsubscribeSecret } = await import("@/lib/unsubscribe.server");
    const secret = unsubscribeSecret();
    if (!secret) throw new Error("Couldn't open this file just now. Please try again.");

    return {
      url: `/f/${await signFileToken(data.fileId, context.userId, secret)}`,
      fileName: file.file_name,
    };
  });

export const removeProductFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ fileId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: file } = await context.supabase
      .from("product_files")
      .select("storage_file_path")
      .eq("id", data.fileId)
      .eq("owner_id", context.userId)
      .single();
    if (!file) throw new Error("File not found");

    await context.supabase.storage.from("digital-assets").remove([file.storage_file_path]);
    const { error } = await context.supabase
      .from("product_files")
      .delete()
      .eq("id", data.fileId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
