import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public, fire-and-forget: the storefront calls this once per session when a
// product page loads, to count a view for the seller's conversion rate. It is
// deliberately best-effort — any failure (including the 0013 migration not
// being applied yet) is swallowed, because a buyer looking at a product must
// never see an error from an analytics counter, and a missing view must never
// hold up the page.
export const recordProductView = createServerFn({ method: "POST" })
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("product_views").insert({ product_id: data.productId });
    } catch {
      // Analytics is a nice-to-have; never surface this to the visitor.
    }
    return { ok: true };
  });
