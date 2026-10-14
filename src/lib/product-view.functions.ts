import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public, fire-and-forget: the storefront calls this once per session when a
// product page loads, to count a view for the seller's conversion rate. It is
// deliberately best-effort — any failure (including the 0013 migration not
// being applied yet) is swallowed, because a buyer looking at a product must
// never see an error from an analytics counter, and a missing view must never
// hold up the page.
export const recordProductView = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        // How they arrived. Capped because they're attacker-controlled strings
        // from a public endpoint; both are normalised to a short label below
        // and the raw values are never stored.
        referrer: z.string().max(2000).optional(),
        utmSource: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sourceFromArrival } = await import("@/lib/record-source.server");

      const source = sourceFromArrival({ referrer: data.referrer, utmSource: data.utmSource });

      const { error } = await supabaseAdmin
        .from("product_views")
        .insert({ product_id: data.productId, source });

      // If 0023 hasn't been applied there's no `source` column, so retry
      // without it: counting the view still matters more than attributing it.
      // 42703 = undefined_column.
      if (error?.code === "42703") {
        await supabaseAdmin.from("product_views").insert({ product_id: data.productId });
      }
    } catch {
      // Analytics is a nice-to-have; never surface this to the visitor.
    }
    return { ok: true };
  });
