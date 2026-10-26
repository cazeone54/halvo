import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { productImageUrl, avatarImageUrl } from "@/lib/public-image-url";
import { summarizeRatings } from "@/lib/ratings";
import { listingPrice } from "@/lib/format";
import { requestCurrency } from "@/lib/currency.server";
import { MAX_FEATURED, bioLinksForDisplay, socialLinksForDisplay } from "@/lib/link-in-bio";

export const getSellerStorefront = createServerFn({ method: "GET" })
  .validator((data) => z.object({ handle: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, bio, avatar_url, accent_color, deactivated_at")
      .eq("handle", data.handle.toLowerCase())
      .single();
    // A deactivated seller's storefront is gone while they're away, not
    // showing an empty shop with their name still on it.
    if (error || !profile || profile.deactivated_at) throw new Error("Storefront not found");

    const { sellerCanTakePayments, isReachableByLink } = await import("@/lib/seller-visibility.server");
    const [{ data: products }, canPay, linkData] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id, name, description, price_cents, price_usd_cents, pay_what_you_want, url_slug, category, image_url, sale_price_cents, sale_ends_at, billing_type, billing_interval")
        .eq("owner_id", profile.id)
        .not("url_slug", "is", null)
        .order("created_at", { ascending: false }),
      sellerCanTakePayments(supabaseAdmin, profile.id),
      // Link-in-bio, read on its own so a missing migration 0028 costs the
      // page its links and nothing else.
      supabaseAdmin
        .from("profiles")
        .select("social_links, bio_links, featured_product_ids")
        .eq("id", profile.id)
        .single()
        .then(({ data: d, error: e }) => (e ? null : d), () => null),
    ]);

    // Until the seller connects Stripe, only their free products are shown:
    // a paid one could only tell buyers it isn't available.
    const rows = (products ?? []).filter((p) => isReachableByLink(p, canPay));

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

    // Resolved once rather than per product: it reads the same request every
    // time. Returned to the page as well, so the storefront can offer the same
    // "pay in the other currency" choice a product page does.
    const currency = requestCurrency();

    const shown = rows.map((p) => {
      const summary = summarizeRatings(ratingsByProduct.get(p.id) ?? []);
      return {
        ...p,
        imageUrl: productImageUrl(p.id, p.image_url),
        price: listingPrice(p, new Date(), currency),
        ratingAverage: summary.average,
        ratingRounded: summary.rounded,
        ratingCount: summary.count,
      };
    });

    // Pinned products come from the visible list, in the seller's order, so a
    // product that's hidden (unpublished, or the seller can't take payments)
    // can never be pinned onto the page.
    const byId = new Map(shown.map((p) => [p.id, p]));
    const featured = (linkData?.featured_product_ids ?? [])
      .slice(0, MAX_FEATURED)
      .map((id) => byId.get(id))
      .filter((p): p is (typeof shown)[number] => !!p);

    return {
      currency,
      profile: { ...profile, avatarUrl: avatarImageUrl(profile.id, profile.avatar_url) },
      social: socialLinksForDisplay(linkData?.social_links),
      // Titles and ids only: the buttons go through /go/<handle>/<id>, which
      // counts the click and looks the address up server-side.
      links: bioLinksForDisplay(linkData?.bio_links).map(({ id, title }) => ({ id, title })),
      featured,
      products: shown,
    };
  });
