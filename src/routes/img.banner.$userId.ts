import { createFileRoute } from "@tanstack/react-router";

// The banner across the top of a seller's shop — a stable public URL, the same
// way as img.avatar.$userId.ts, only ever resolving that seller's own banner.
export const Route = createFileRoute("/img/banner/$userId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { isOwnStoredImage } = await import("@/lib/avatar");

        // Before migration 0030 the column doesn't exist; that's just "no banner".
        const { data: profile, error } = await supabaseAdmin
          .from("profiles")
          .select("id, banner_path")
          .eq("id", params.userId)
          .single();
        const path = profile?.banner_path;
        if (error || !profile || !isOwnStoredImage(path, profile.id, "banner")) {
          return new Response("Not found", { status: 404 });
        }

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
