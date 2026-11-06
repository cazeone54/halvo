import { createFileRoute } from "@tanstack/react-router";
import { galleryImageUrls } from "@/lib/product-media";

// Stable public URL for one of a product's gallery images — same approach as
// the cover image route: only ever serves a path recorded in the product's own
// gallery_paths.
export const Route = createFileRoute("/img/gallery/$productId/$index")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const index = Number(params.index);
        if (!Number.isInteger(index) || index < 0) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { serveStoredImage } = await import("@/lib/stored-image.server");
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("id", params.productId)
          .maybeSingle();
        const path = product?.gallery_paths?.[index];
        if (!path) return new Response("Not found", { status: 404 });

        return serveStoredImage(request, path, galleryImageUrls(params.productId, product.gallery_paths)[index], product.owner_id);
      },
    },
  },
});
