import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { productImageUrl } from "@/lib/public-image-url";

// Public — the order-bump offer shown at checkout for a given product. Returns
// null (never throws) so a product page renders identically whether or not a
// bump is configured, and whether or not migration 0012 has been applied.
export const getProductBump = createServerFn({ method: "GET" })
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: bump } = await supabaseAdmin
        .from("product_bumps")
        .select("bump_product_id, price_cents")
        .eq("product_id", data.productId)
        .maybeSingle();
      if (!bump) return null;

      // The add-on has to be a real, deliverable product.
      const { data: bumpProduct } = await supabaseAdmin
        .from("products")
        .select("id, name, description, image_url")
        .eq("id", bump.bump_product_id)
        .maybeSingle();
      if (!bumpProduct) return null;

      return {
        bumpProductId: bumpProduct.id,
        name: bumpProduct.name,
        description: bumpProduct.description,
        priceCents: bump.price_cents,
        imageUrl: productImageUrl(bumpProduct.id, bumpProduct.image_url),
      };
    } catch {
      return null;
    }
  });

// Seller: view/set the bump for one of their products.
export const getBumpEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: products } = await context.supabase
      .from("products")
      .select("id, name, price_cents")
      .eq("owner_id", context.userId);

    const { data: current } = await context.supabase
      .from("product_bumps")
      .select("bump_product_id, price_cents")
      .eq("product_id", data.productId)
      .eq("owner_id", context.userId)
      .maybeSingle();

    return {
      current: current ? { bumpProductId: current.bump_product_id, priceCents: current.price_cents } : null,
      available: (products ?? []).filter((p) => p.id !== data.productId),
    };
  });

export const setProductBump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        bumpProductId: z.string().uuid(),
        priceCents: z.number().int().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.productId === data.bumpProductId) throw new Error("A product can't bump itself.");

    // Own both, same reason as bundles: never let a seller sell someone else's
    // product as an add-on.
    const { data: owned } = await context.supabase
      .from("products")
      .select("id")
      .eq("owner_id", context.userId)
      .in("id", [data.productId, data.bumpProductId]);
    if (!owned || owned.length !== 2) throw new Error("Product not found");

    const { error } = await context.supabase.from("product_bumps").upsert(
      {
        product_id: data.productId,
        bump_product_id: data.bumpProductId,
        price_cents: data.priceCents,
        owner_id: context.userId,
      },
      { onConflict: "product_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeProductBump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_bumps")
      .delete()
      .eq("product_id", data.productId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
