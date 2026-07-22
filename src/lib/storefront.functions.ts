import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSellerStorefront = createServerFn({ method: "GET" })
  .validator((data) => z.object({ handle: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, bio")
      .eq("handle", data.handle.toLowerCase())
      .single();
    if (error || !profile) throw new Error("Storefront not found");

    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, description, price_cents, pay_what_you_want, url_slug")
      .eq("owner_id", profile.id)
      .not("url_slug", "is", null)
      .order("created_at", { ascending: false });

    return { profile, products: products ?? [] };
  });
