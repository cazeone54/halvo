import { createFileRoute } from "@tanstack/react-router";

// Same reasoning as img.product.$productId.ts — a stable public URL for a
// seller's avatar, only ever resolving that user's own avatar_url.
export const Route = createFileRoute("/img/avatar/$userId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url")
          .eq("id", params.userId)
          .single();
        if (!profile?.avatar_url) return new Response("Not found", { status: 404 });

        // A provider photo copied in at sign-up (Google's lh3 link) — redirect
        // to it, but only for allow-listed hosts; anything else would make this
        // an open redirect. See @/lib/avatar.
        const { trustedExternalAvatar, isStoredAvatarPath } = await import("@/lib/avatar");
        const external = trustedExternalAvatar(profile.avatar_url);
        if (external) {
          return new Response(null, {
            status: 302,
            headers: { Location: external, "Cache-Control": "public, max-age=3300" },
          });
        }
        // A URL from anywhere else isn't a storage path either; asking storage
        // to sign it was what produced broken images before.
        if (!isStoredAvatarPath(profile.avatar_url)) return new Response("Not found", { status: 404 });

        // Cached the same way as product images — an avatar shouldn't be a
        // fresh sign operation on every storefront view.
        const { data: signed } = await supabaseAdmin.storage
          .from("digital-assets")
          .createSignedUrl(profile.avatar_url, 3600);
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
