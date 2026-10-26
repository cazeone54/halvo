import { createFileRoute } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/site";
import { GUIDES } from "@/content/guides";
import { BLOG_POSTS } from "@/content/blog";
import { AUDIENCES } from "@/content/audiences";

const STATIC_PATHS = [
  "/",
  "/features",
  "/pricing",
  "/guides",
  "/blog",
  "/faq",
  "/access",
  "/contact",
  "/discover",
  "/terms",
  "/privacy",
  "/refund-policy",
  // Guides and blog posts are the real organic-search surface, so each one
  // needs its own entry rather than relying on the index pages.
  ...GUIDES.map((guide) => `/guides/${guide.slug}`),
  ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
  ...AUDIENCES.map((audience) => `/for/${audience.slug}`),
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Every published product and every seller's storefront — previously
        // the sitemap only listed static marketing pages, so individual
        // product pages had no path to ever getting indexed by search
        // engines at all.
        const { loadListingVisibility, isListedPublicly } = await import("@/lib/seller-visibility.server");

        const [{ data: products }, { data: profiles }, visibility] = await Promise.all([
          supabaseAdmin.from("products").select("owner_id, url_slug").not("url_slug", "is", null),
          supabaseAdmin.from("profiles").select("id, handle").not("handle", "is", null),
          loadListingVisibility(supabaseAdmin),
        ]);

        // Deactivated sellers' pages 404, and sellers who haven't connected
        // Stripe have nothing buyers can purchase, so listing either would feed
        // search engines dead or empty URLs. A storefront follows the same
        // rule as its products.
        const paths = [
          ...STATIC_PATHS,
          ...(products ?? []).filter((p) => isListedPublicly(p, visibility)).map((p) => `/p/${p.url_slug}`),
          ...(profiles ?? [])
            .filter((p) => isListedPublicly({ owner_id: p.id }, visibility))
            .map((p) => `/${p.handle}`),
        ];

        const urls = paths.map((path) => `  <url><loc>${BASE_URL}${path}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml" } });
      },
    },
  },
});
