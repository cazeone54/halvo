import { createServerFn } from "@tanstack/react-start";
import { productImageUrl, avatarImageUrl } from "@/lib/public-image-url";
import { listingPrice } from "@/lib/format";
import { requestCurrency } from "@/lib/currency.server";

const STRIP = 8;
const SHOP_PREVIEW = 6;

// Real products for the homepage, instead of icons describing them: the newest
// things on sale, and one real shop to show what a seller's page looks like.
// The same rule as Discover decides what can appear — nothing hidden, nothing
// from a seller who can't take payments.
export const getHomeShowcase = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadListingVisibility, isListedPublicly } = await import("@/lib/seller-visibility.server");

  const [{ data: products, error }, visibility] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, owner_id, name, price_cents, price_usd_cents, pay_what_you_want, url_slug, image_url, created_at, sale_price_cents, sale_ends_at, billing_type, billing_interval")
      .not("url_slug", "is", null)
      // A row of covers: products without one would be grey boxes.
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    loadListingVisibility(supabaseAdmin),
  ]);
  if (error) throw new Error(error.message);
  const rows = (products ?? []).filter((p) => isListedPublicly(p, visibility));

  const currency = requestCurrency();
  const now = new Date();
  const card = (p: (typeof rows)[number]) => ({
    id: p.id,
    name: p.name,
    url_slug: p.url_slug,
    imageUrl: productImageUrl(p.id, p.image_url),
    price: listingPrice(p, now, currency),
    price_cents: p.price_cents,
    sale_price_cents: p.sale_price_cents,
    ratingRounded: 0,
    ratingCount: 0,
  });

  // The shop with the most on sale shows best what a full one looks like.
  const counts = new Map<string, number>();
  for (const p of rows) if (p.owner_id) counts.set(p.owner_id, (counts.get(p.owner_id) ?? 0) + 1);
  const topOwner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  let shop: {
    handle: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    productCount: number;
    products: ReturnType<typeof card>[];
  } | null = null;
  if (topOwner) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, bio, avatar_url")
      .eq("id", topOwner)
      .single();
    if (profile?.handle) {
      shop = {
        handle: profile.handle,
        name: profile.display_name ?? profile.handle,
        bio: profile.bio,
        avatarUrl: avatarImageUrl(profile.id, profile.avatar_url),
        productCount: counts.get(topOwner) ?? 0,
        products: rows.filter((p) => p.owner_id === topOwner).slice(0, SHOP_PREVIEW).map(card),
      };
    }
  }

  return { products: rows.slice(0, STRIP).map(card), shop };
});
