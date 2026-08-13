import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { productImageUrl, avatarImageUrl } from "@/lib/public-image-url";
import { summarizeRatings } from "@/lib/ratings";

export const getSellerStorefront = createServerFn({ method: "GET" })
  .validator((data) => z.object({ handle: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, bio, avatar_url")
      .eq("handle", data.handle.toLowerCase())
      .single();
    if (error || !profile) throw new Error("Storefront not found");

    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, description, price_cents, pay_what_you_want, url_slug, category, image_url")
      .eq("owner_id", profile.id)
      .not("url_slug", "is", null)
      .order("created_at", { ascending: false });

    const rows = products ?? [];

    // Star ratings per product — one batched, best-effort read (same pattern as
    // discover), so the storefront shows social proof but never breaks if the
    // reviews table is unmigrated.
    const ratingsByProduct = new Map<string, number[]>();
    if (rows.length > 0) {
      try {
        const { data: reviews } = await supabaseAdmin
          .from("reviews")
          .select("product_id, rating")
          .in(
            "product_id",
            rows.map((r) => r.id),
          );
        for (const rev of reviews ?? []) {
          const arr = ratingsByProduct.get(rev.product_id) ?? [];
          arr.push(rev.rating);
          ratingsByProduct.set(rev.product_id, arr);
        }
      } catch {
        // reviews unavailable — cards render without stars.
      }
    }

    return {
      profile: { ...profile, avatarUrl: avatarImageUrl(profile.id, profile.avatar_url) },
      products: rows.map((p) => {
        const summary = summarizeRatings(ratingsByProduct.get(p.id) ?? []);
        return {
          ...p,
          imageUrl: productImageUrl(p.id, p.image_url),
          ratingAverage: summary.average,
          ratingRounded: summary.rounded,
          ratingCount: summary.count,
        };
      }),
    };
  });
