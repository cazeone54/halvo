import { createFileRoute } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/site";

const STATIC_PATHS = ["/", "/pricing", "/faq", "/discover", "/terms", "/privacy", "/refund-policy"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Every published product and every seller's storefront — previously
        // the sitemap only listed static marketing pages, so individual
        // product pages had no path to ever getting indexed by search
        // engines at all.
        const [{ data: products }, { data: profiles }] = await Promise.all([
          supabaseAdmin.from("products").select("url_slug").not("url_slug", "is", null),
          supabaseAdmin.from("profiles").select("handle").not("handle", "is", null),
        ]);

        const paths = [
          ...STATIC_PATHS,
          ...(products ?? []).map((p) => `/p/${p.url_slug}`),
          ...(profiles ?? []).map((p) => `/u/${p.handle}`),
        ];

        const urls = paths.map((path) => `  <url><loc>${BASE_URL}${path}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml" } });
      },
    },
  },
});
