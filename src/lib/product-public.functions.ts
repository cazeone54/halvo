import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getProductPublicView = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, name, description, price_cents, pay_what_you_want, url_slug, owner_id")
      .eq("url_slug", data.slug)
      .single();
    if (error || !product) throw new Error("Product not found");

    let sellerName: string | null = null;
    if (product.owner_id) {
      const { data: seller } = await supabaseAdmin
        .from("profiles")
        .select("display_name, handle")
        .eq("id", product.owner_id)
        .single();
      sellerName = seller?.display_name ?? seller?.handle ?? null;
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.price_cents,
      payWhatYouWant: product.pay_what_you_want,
      sellerName,
    };
  });
