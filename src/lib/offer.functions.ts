import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateOffer } from "@/lib/offer";

export const setProductOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        stockLimit: z.number().int().nullable(),
        salePriceCents: z.number().int().nullable(),
        saleEndsAt: z.string().datetime({ offset: true }).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: product } = await context.supabase
      .from("products")
      .select("id, price_cents, pay_what_you_want")
      .eq("id", data.productId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!product) throw new Error("Product not found");

    const { count } = await context.supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id)
      .eq("status", "success");

    const problem = validateOffer(
      {
        priceCents: product.price_cents,
        payWhatYouWant: product.pay_what_you_want,
        salePriceCents: data.salePriceCents,
        saleEndsAt: data.saleEndsAt,
        stockLimit: data.stockLimit,
        soldCount: count ?? 0,
      },
      new Date(),
    );
    if (problem) throw new Error(problem);

    const { error } = await context.supabase
      .from("products")
      .update({
        stock_limit: data.stockLimit,
        sale_price_cents: data.salePriceCents,
        sale_ends_at: data.saleEndsAt,
      })
      .eq("id", product.id)
      .eq("owner_id", context.userId);
    if (error) {
      if (error.code === "42703" || /schema cache|column .* does not exist/i.test(error.message)) {
        throw new Error("Launch offers need database migration 0019 — apply it in the Supabase SQL editor, then try again.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });
