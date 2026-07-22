import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { PLAN_LIMITS } from "@/lib/plans";
import type { Database } from "@/integrations/supabase/types";

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
      .select("id, name, description, price_cents, pay_what_you_want, url_slug, category, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
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

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .delete()
      .eq("id", data.productId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
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

// Client uploads the file bytes directly to Supabase Storage (owner-prefixed
// path, allowed by RLS); this just records the resulting row.
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
