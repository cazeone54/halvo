import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { PLAN_LIMITS } from "@/lib/plans";
import { checkUploadAgainstLimits } from "@/lib/upload-limits";
import type { Database } from "@/integrations/supabase/types";

async function currentUploadUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  productId: string,
): Promise<{ currentCountForProduct: number; usedBytesAcrossAllProducts: number }> {
  const { count } = await supabase
    .from("product_files")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const { data: files } = await supabase.from("product_files").select("size_bytes").eq("owner_id", userId);
  const usedBytesAcrossAllProducts = (files ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);

  return { currentCountForProduct: count ?? 0, usedBytesAcrossAllProducts };
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
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name, description, price_cents, pay_what_you_want, url_slug, category, image_url, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return Promise.all(
      data.map(async (product) => {
        if (!product.image_url) return { ...product, imageUrl: null };
        const { data: signed } = await context.supabase.storage
          .from("digital-assets")
          .createSignedUrl(product.image_url, 60 * 60);
        return { ...product, imageUrl: signed?.signedUrl ?? null };
      }),
    );
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

    const slug = slugify(data.name, Math.random().toString(36).slice(2, 8));
    const { data: product, error } = await context.supabase
      .from("products")
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        price_cents: data.priceCents,
        pay_what_you_want: data.payWhatYouWant ?? false,
        category: data.category ?? null,
        url_slug: slug,
      })
      .select("id, url_slug")
      .single();
    if (error || !product) throw new Error(error?.message ?? "Could not create product");
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
        payWhatYouWant: z.boolean().optional(),
        category: z.string().trim().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { productId, ...rest } = data;
    const update: Database["public"]["Tables"]["products"]["Update"] = {};
    if (rest.name !== undefined) update.name = rest.name;
    if (rest.description !== undefined) update.description = rest.description;
    if (rest.priceCents !== undefined) update.price_cents = rest.priceCents;
    if (rest.payWhatYouWant !== undefined) update.pay_what_you_want = rest.payWhatYouWant;
    if (rest.category !== undefined) update.category = rest.category;

    const { error } = await context.supabase
      .from("products")
      .update(update)
      .eq("id", productId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
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

    const { error } = await context.supabase
      .from("products")
      .delete()
      .eq("id", data.productId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    if (files && files.length > 0) {
      await context.supabase.storage.from("digital-assets").remove(files.map((f) => f.storage_file_path));
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
    const tier = await resolveUserTier(context.supabase, context.userId);
    const usage = await currentUploadUsage(context.supabase, context.userId, data.productId);
    const rejection = checkUploadAgainstLimits({ sizeBytes: data.sizeBytes, ...usage }, PLAN_LIMITS[tier]);
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
      .select("id")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .single();
    if (!product) throw new Error("Product not found");

    const tier = await resolveUserTier(context.supabase, context.userId);
    const usage = await currentUploadUsage(context.supabase, context.userId, data.productId);
    const rejection = checkUploadAgainstLimits({ sizeBytes: data.sizeBytes, ...usage }, PLAN_LIMITS[tier]);
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
    return { ok: true };
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
