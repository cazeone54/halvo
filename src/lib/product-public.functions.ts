import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { productImageUrl } from "@/lib/public-image-url";
import { summarizeRatings } from "@/lib/ratings";
import { galleryImageUrls, parseVideoUrl } from "@/lib/product-media";
import { activeSalePriceCents, stockRemaining } from "@/lib/offer";
import { countSuccessfulSales } from "@/lib/offer.server";
import { listingPrice } from "@/lib/format";
import { STANDARD_REFUND_POLICY } from "@/lib/refund-terms";

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

      const { sellerCanTakePayments, isReachableByLink } = await import("@/lib/seller-visibility.server");
      const [{ data: others }, canPay] = await Promise.all([
        supabaseAdmin
          .from("products")
          .select("id, name, price_cents, pay_what_you_want, url_slug, image_url, sale_price_cents, sale_ends_at, billing_type, billing_interval")
          .eq("owner_id", current.owner_id)
          .neq("id", data.productId)
          .not("url_slug", "is", null) // published only
          .order("created_at", { ascending: false })
          .limit(4),
        sellerCanTakePayments(supabaseAdmin, current.owner_id),
      ]);

      return {
        products: (others ?? []).filter((p) => isReachableByLink(p, canPay)).map((p) => ({
          id: p.id,
          name: p.name,
          priceCents: p.price_cents,
          payWhatYouWant: p.pay_what_you_want,
          price: listingPrice(p),
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

    // select("*") so optional columns from later migrations come through when
    // present — the curated return below never exposes the extra columns.
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("url_slug", data.slug)
      .single();
    if (error || !product) throw new Error("Product not found");

    // The seller profile, sales count, and review summary each depend only on
    // the product row we already have — so run them concurrently rather than
    // three sequential round-trips on the checkout page (the money page, where
    // latency matters most). Each is independently defensive.
    const { sellerCanTakePayments, isReachableByLink } = await import("@/lib/seller-visibility.server");
    const [sellerRes, salesRes, reviewSummary, sellerCanPay] = await Promise.all([
      product.owner_id
        ? supabaseAdmin
            .from("profiles")
            .select("display_name, handle, support_email, accent_color, deactivated_at")
            .eq("id", product.owner_id)
            .single()
        : Promise.resolve({ data: null }),
      countSuccessfulSales(supabaseAdmin, product.id).then((count) => ({ count })),
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
      product.owner_id ? sellerCanTakePayments(supabaseAdmin, product.owner_id) : Promise.resolve(null),
    ]);

    // While a seller is deactivated their product pages read as gone rather
    // than as a buyable page that fails at checkout. Deactivation deliberately
    // keeps url_slug, so this is where an old or shared link stops working.
    if (sellerRes.data?.deactivated_at) throw new Error("Product not found");
    // Same for a paid product whose seller hasn't connected Stripe: nobody can
    // buy it, so its page doesn't exist for buyers until they do.
    if (!isReachableByLink(product, sellerCanPay)) throw new Error("Product not found");

    const seller = sellerRes.data;
    const sellerName = seller?.display_name ?? seller?.handle ?? null;
    const sellerHandle = seller?.handle ?? null;
    // Every product on Halvo has the same final-sale policy (see refund-terms.ts);
    // sellers' old free-text policies are no longer shown. Free products need none.
    const isFreeProduct = !product.pay_what_you_want && product.price_cents === 0;
    const refundPolicy = isFreeProduct ? null : STANDARD_REFUND_POLICY;
    const supportEmail = seller?.support_email ?? null;
    const salesCount = salesRes.count ?? 0;
    const reviewCount = reviewSummary.count;
    const reviewAverage = reviewSummary.average;

    // Offer columns are absent until migration 0019 → no sale, no limit.
    const salePriceCents = activeSalePriceCents(product, new Date());
    const stockLeft = stockRemaining(product.stock_limit, salesCount);

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      // The price checkout will charge now; regularPriceCents is set only during a sale.
      priceCents: salePriceCents ?? product.price_cents,
      price: listingPrice(product),
      regularPriceCents: salePriceCents != null ? product.price_cents : null,
      saleEndsAt: salePriceCents != null ? (product.sale_ends_at ?? null) : null,
      stockLimit: product.stock_limit ?? null,
      stockRemaining: stockLeft,
      soldOut: stockLeft === 0,
      payWhatYouWant: product.pay_what_you_want,
      imageUrl: productImageUrl(product.id, product.image_url),
      // Both absent until migration 0018 — the page then shows just the cover.
      video: parseVideoUrl(product.preview_video_url),
      galleryUrls: galleryImageUrls(product.id, product.gallery_paths),
      sellerName,
      sellerHandle,
      accentColor: seller?.accent_color ?? null,
      refundPolicy,
      supportEmail,
      salesCount,
      reviewCount,
      reviewAverage,
      // Lets the checkout page advertise "includes a license key" to buyers.
      // Absent (undefined) until migration 0016 → coerced to false.
      licenseKeyEnabled: product.license_key_enabled === true,
      // Absent until migration 0020 → a normal one-time product.
      billingType: product.billing_type === "membership" ? ("membership" as const) : ("one_time" as const),
      billingInterval: product.billing_interval === "year" ? ("year" as const) : ("month" as const),
      installmentCount: product.billing_type === "membership" ? null : (product.installment_count ?? null),
    };
  });
