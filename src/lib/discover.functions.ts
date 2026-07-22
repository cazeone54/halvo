import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listDiscover = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        search: z.string().trim().max(100).optional(),
        category: z.string().trim().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("products")
      .select("id, name, description, price_cents, pay_what_you_want, url_slug, category")
      .not("url_slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(60);

    if (data.category) query = query.eq("category", data.category);
    if (data.search) query = query.or(`name.ilike.%${data.search}%,description.ilike.%${data.search}%`);

    const { data: products, error } = await query;
    if (error) throw new Error(error.message);
    return products ?? [];
  });
