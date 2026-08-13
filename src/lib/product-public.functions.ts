import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { productImageUrl } from "@/lib/public-image-url";
import { summarizeRatings } from "@/lib/ratings";

// Other published products by the same seller — powers a "More from this
// seller" cross-sell on the product page (and a discovery nudge post-purchase).
// Public and best-effort: any failure just yields an empty list, and a seller
// with only one product naturally returns nothing (so the section hides).
export const listMoreFromSeller = createServerFn({ method: "GET" })
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: current } = await supabaseAdmin
        .from("products")
        .select("owner_id")
        .eq("id", data.productId)
        .single();
      if (!current?.owner_id) return { products: [] };

      const { data: others } = await supabaseAdmin
        .from("products")
        .select("id, name, price_cents, pay_what_you_want, url_slug, image_url")
        .eq("owner_id", current.owner_id)
        .neq("id", data.productId)
        .not("url_slug", "is", null) // published only
        .order("created_at", { ascending: false })
        .limit(4);

      return {
        products: (others ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          priceCents: p.price_cents,
          payWhatYouWant: p.pay_what_you_want,
          slug: p.url_slug as string,
          imageUrl: productImageUrl(p.id, p.image_url),
        })),
      };
    } catch {
      return { products: [] };
    }
  });

export const getProductPublicView = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // select("*") so a per-product refund_policy (migration 0015) comes through
    // when present and is simply absent when it isn't — the curated return below
    // never exposes the extra columns.
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("url_slug", data.slug)
      .single();
    if (error || !product) throw new Error("Product not found");

    // A per-product refund policy overrides the seller's account-wide one.
    const productRefundPolicy = product.refund_policy ?? null;

    // The seller profile, sales count, and review summary each depend only on
    // the product row we already have — so run them concurrently rather than
    // three sequential round-trips on the checkout page (the money page, where
    // latency matters most). Each is independently defensive.
    const [sellerRes, salesRes, reviewSummary] = await Promise.all([
      product.owner_id
        ? supabaseAdmin
            .from("profiles")
            .select("display_name, handle, refund_policy, support_email")
            .eq("id", product.owner_id)
            .single()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .eq("status", "success"),
      // Review summary, computed server-side so the page can emit an
      // aggregateRating in its structured data (star ratings in search results).
      // Best-effort: the table may be unmigrated, so any failure yields no rating
      // rather than breaking the page.
      (async () => {
        try {
          const { data: ratingRows } = await supabaseAdmin
            .from("reviews")
            .select("rating")
            .eq("product_id", product.id)
            .limit(1000);
          return summarizeRatings((ratingRows ?? []).map((r) => r.rating));
        } catch {
          return summarizeRatings([]);
        }
      })(),
    ]);

    const seller = sellerRes.data;
    const sellerName = seller?.display_name ?? seller?.handle ?? null;
    const sellerHandle = seller?.handle ?? null;
    const refundPolicy = productRefundPolicy ?? seller?.refund_policy ?? null;
    const supportEmail = seller?.support_email ?? null;
    const salesCount = salesRes.count ?? 0;
    const reviewCount = reviewSummary.count;
    const reviewAverage = reviewSummary.average;

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.price_cents,
      payWhatYouWant: product.pay_what_you_want,
      imageUrl: productImageUrl(product.id, product.image_url),
      sellerName,
      sellerHandle,
      refundPolicy,
      supportEmail,
      salesCount,
      reviewCount,
      reviewAverage,
      // Lets the checkout page advertise "includes a license key" to buyers.
      // Absent (undefined) until migration 0016 → coerced to false.
      licenseKeyEnabled: product.license_key_enabled === true,
    };
  });
