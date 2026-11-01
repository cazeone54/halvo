import { createFileRoute } from "@tanstack/react-router";
import { productImageUrl } from "@/lib/public-image-url";

// A stable, public URL for a product's cover image. Only ever serves the
// product's own `image_url` looked up from the DB — never an arbitrary
// storage path — so this can't be used to reach the private downloadable
// files bucket, only the marketing image that's meant to be public anyway.
//
// This exists because embedding a signed Storage URL directly as `og:image`
// breaks once that URL's short TTL expires and a platform (Slack, Twitter,
// iMessage) re-fetches the preview later. This URL never expires. Pages add
// `&w=` for a resized copy (stored-image.server.ts); og:image leaves it off and
// gets the original.
export const Route = createFileRoute("/img/product/$productId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { serveStoredImage } = await import("@/lib/stored-image.server");

        const { data: product } = await supabaseAdmin
          .from("products")
          .select("image_url")
          .eq("id", params.productId)
          .single();
        if (!product?.image_url) return new Response("Not found", { status: 404 });

        return serveStoredImage(request, product.image_url, productImageUrl(params.productId, product.image_url)!);
      },
    },
  },
});
