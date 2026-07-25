import { createFileRoute } from "@tanstack/react-router";

// A stable, public URL for a product's cover image. Only ever serves the
// product's own `image_url` looked up from the DB — never an arbitrary
// storage path — so this can't be used to reach the private downloadable
// files bucket, only the marketing image that's meant to be public anyway.
//
// This exists because embedding a signed Storage URL directly as `og:image`
// breaks once that URL's short TTL expires and a platform (Slack, Twitter,
// iMessage) re-fetches the preview later. This URL never expires — it
// redirects to a freshly-signed URL on every request.
export const Route = createFileRoute("/img/product/$productId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: product } = await supabaseAdmin
          .from("products")
          .select("image_url")
          .eq("id", params.productId)
          .single();
        if (!product?.image_url) return new Response("Not found", { status: 404 });

        // Sign for an hour and let the redirect itself be cached for just under
        // that, so a product thumbnail on Discover isn't a fresh DB lookup +
        // sign operation on every single render. Cover images are public
        // marketing content, so a longer TTL carries no real risk. This turns
        // "re-sign on every request" into "at most once per hour per CDN edge".
        const { data: signed } = await supabaseAdmin.storage
          .from("digital-assets")
          .createSignedUrl(product.image_url, 3600);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });

        return new Response(null, {
          status: 302,
          headers: {
            Location: signed.signedUrl,
            "Cache-Control": "public, max-age=3300",
          },
        });
      },
    },
  },
});
