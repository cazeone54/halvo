import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/products.functions";
import { LINK_LABEL_MAX, normalizeDeliveryUrl } from "@/lib/product-link";

// Before migration 0033 the table doesn't exist (or lacks its grant).
function notMigrated(error: { code?: string; message: string } | null): boolean {
  return (
    !!error &&
    (error.code === "42P01" ||
      error.code === "42501" ||
      /schema cache|could not find the table|permission denied/i.test(error.message))
  );
}

// The link a buyer gets instead of (or as well as) a file. Saving the first
// one publishes a draft, exactly like attaching the first file does: it's the
// moment the product has something to deliver.
export const setProductLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        url: z.string().max(2100),
        label: z.string().trim().max(LINK_LABEL_MAX).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const checked = normalizeDeliveryUrl(data.url);
    if ("error" in checked) throw new Error(checked.error);

    const { data: product } = await context.supabase
      .from("products")
      .select("id, name, url_slug")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .single();
    if (!product) throw new Error("Product not found");

    const { error } = await context.supabase.from("product_links").upsert(
      {
        product_id: product.id,
        owner_id: context.userId,
        url: checked.url,
        label: data.label || null,
      },
      { onConflict: "product_id" },
    );
    if (error) {
      if (notMigrated(error)) throw new Error("Links aren't switched on yet. Please upload a file for now.");
      throw new Error(error.message);
    }

    const wasDraft = product.url_slug === null;
    let urlSlug = product.url_slug;
    if (wasDraft) {
      urlSlug = slugify(product.name, Math.random().toString(36).slice(2, 8));
      const { error: publishError } = await context.supabase
        .from("products")
        .update({ url_slug: urlSlug })
        .eq("id", product.id)
        .eq("owner_id", context.userId);
      if (publishError) throw new Error(publishError.message);
    }
    return { ok: true, published: wasDraft, urlSlug, url: checked.url };
  });

// Removing the link never unpublishes on its own, the same as removing a
// file: checkout already refuses a product with nothing left to deliver.
export const removeProductLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_links")
      .delete()
      .eq("product_id", data.productId)
      .eq("owner_id", context.userId);
    if (error && !notMigrated(error)) throw new Error(error.message);
    return { ok: true };
  });
