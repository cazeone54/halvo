import { createFileRoute } from "@tanstack/react-router";

// Stable public URL for one of a product's gallery images — same approach as
// the cover image route: only ever serves a path recorded in the product's own
// gallery_paths, redirecting to a freshly signed URL.
export const Route = createFileRoute("/img/gallery/$productId/$index")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const index = Number(params.index);
        if (!Number.isInteger(index) || index < 0) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("id", params.productId)
          .maybeSingle();
        const path = product?.gallery_paths?.[index];
        if (!path) return new Response("Not found", { status: 404 });

        const { data: signed } = await supabaseAdmin.storage.from("digital-assets").createSignedUrl(path, 3600);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });

        return new Response(null, {
          status: 302,
          headers: { Location: signed.signedUrl, "Cache-Control": "public, max-age=3300" },
        });
      },
    },
  },
});
