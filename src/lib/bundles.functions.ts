import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// What's in a bundle, plus the seller's other products that could be added.
export const getBundleEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: products } = await context.supabase
      .from("products")
      .select("id, name")
      .eq("owner_id", context.userId);

    const { data: items } = await context.supabase
      .from("bundle_items")
      .select("id, item_product_id")
      .eq("bundle_product_id", data.productId)
      .eq("owner_id", context.userId);

    const byId = new Map((products ?? []).map((p) => [p.id, p.name]));
    const included = (items ?? []).map((row) => ({
      id: row.id,
      productId: row.item_product_id,
      name: byId.get(row.item_product_id) ?? "Unknown product",
    }));
    const includedIds = new Set(included.map((i) => i.productId));

    return {
      included,
      // A bundle can't contain itself, and can't contain something already in it.
      available: (products ?? []).filter((p) => p.id !== data.productId && !includedIds.has(p.id)),
    };
  });

export const addBundleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ bundleProductId: z.string().uuid(), itemProductId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.bundleProductId === data.itemProductId) {
      throw new Error("A bundle can't contain itself.");
    }

    // Verify the caller owns BOTH products before linking them — otherwise a
    // seller could bundle (and therefore give away) someone else's product.
    const { data: owned } = await context.supabase
      .from("products")
      .select("id, url_slug, name")
      .eq("owner_id", context.userId)
      .in("id", [data.bundleProductId, data.itemProductId]);
    if (!owned || owned.length !== 2) throw new Error("Product not found");

    const { error } = await context.supabase.from("bundle_items").insert({
      bundle_product_id: data.bundleProductId,
      item_product_id: data.itemProductId,
      owner_id: context.userId,
    });
    if (error && error.code !== "23505") throw new Error(error.message);

    // Adding an item can make a bundle deliverable for the first time, so it
    // publishes here for the same reason attaching a file does.
    const bundle = owned.find((p) => p.id === data.bundleProductId);
    let published = false;
    if (bundle && bundle.url_slug === null) {
      const slug = `${bundle.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60)}-${Math.random().toString(36).slice(2, 8)}`;
      const { error: publishError } = await context.supabase
        .from("products")
        .update({ url_slug: slug })
        .eq("id", data.bundleProductId)
        .eq("owner_id", context.userId);
      if (!publishError) published = true;
    }

    return { ok: true, published };
  });

export const removeBundleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bundle_items")
      .delete()
      .eq("id", data.itemId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
