import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_GALLERY_IMAGES, isOwnProductPath, parseVideoUrl } from "@/lib/product-media";

const MAX_IMAGE_MB = 5;

function friendlyError(error: { code?: string; message: string }): Error {
  if (error.code === "42703" || /schema cache|column .* does not exist/i.test(error.message)) {
    return new Error("Product media needs database migration 0018 — apply it in the Supabase SQL editor, then try again.");
  }
  return new Error(error.message);
}

export const setProductVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid(), url: z.string().trim().max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.url && !parseVideoUrl(data.url)) {
      throw new Error("Use a YouTube, Vimeo or Loom link.");
    }
    const { data: updated, error } = await context.supabase
      .from("products")
      .update({ preview_video_url: data.url || null })
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .select("id");
    if (error) throw friendlyError(error);
    if (!updated?.length) throw new Error("Product not found");
    return { ok: true };
  });

export const addGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        storageFilePath: z.string().min(1).max(500),
        sizeBytes: z.number().int().positive().max(MAX_IMAGE_MB * 1024 * 1024),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const discard = () => context.supabase.storage.from("digital-assets").remove([data.storageFilePath]);
    if (!isOwnProductPath(data.storageFilePath, context.userId, data.productId)) {
      throw new Error("Invalid image path");
    }

    const { data: product, error: readError } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (readError || !product) {
      await discard();
      throw readError ? friendlyError(readError) : new Error("Product not found");
    }
    if (!("gallery_paths" in product)) {
      await discard();
      throw friendlyError({ code: "42703", message: "" });
    }
    const current = product.gallery_paths ?? [];
    if (current.length >= MAX_GALLERY_IMAGES) {
      await discard();
      throw new Error(`A product can have up to ${MAX_GALLERY_IMAGES} gallery images.`);
    }

    const { error } = await context.supabase
      .from("products")
      .update({ gallery_paths: [...current, data.storageFilePath] })
      .eq("id", data.productId)
      .eq("owner_id", context.userId);
    if (error) {
      await discard();
      throw friendlyError(error);
    }
    return { ok: true };
  });

export const removeGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ productId: z.string().uuid(), index: z.number().int().min(0).max(MAX_GALLERY_IMAGES - 1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: product, error: readError } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (readError) throw friendlyError(readError);
    const current = product?.gallery_paths ?? [];
    const path = current[data.index];
    if (!path) throw new Error("Image not found");

    const { error } = await context.supabase
      .from("products")
      .update({ gallery_paths: current.filter((_, i) => i !== data.index) })
      .eq("id", data.productId)
      .eq("owner_id", context.userId);
    if (error) throw friendlyError(error);
    await context.supabase.storage.from("digital-assets").remove([path]);
    return { ok: true };
  });
