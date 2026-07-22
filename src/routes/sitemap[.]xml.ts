import { createFileRoute } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/site";

const STATIC_PATHS = ["/", "/pricing", "/faq", "/discover", "/terms", "/privacy", "/refund-policy"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = STATIC_PATHS.map((path) => `  <url><loc>${BASE_URL}${path}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml" } });
      },
    },
  },
});
