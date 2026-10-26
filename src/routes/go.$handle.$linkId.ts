import { createFileRoute } from "@tanstack/react-router";
import { isLikelyBot } from "@/lib/link-in-bio";
import { isRateLimited } from "@/lib/rate-limit";

// A button on a seller's link-in-bio page: halvo.io/go/<handle>/<link>.
//
// It counts the click, then sends the visitor on. The destination is looked up
// here from the link's id, never taken from the address, so this can't be
// used to bounce people to an arbitrary site with halvo.io's name on the link.
// Link previews and bots aren't counted, nor is the same person tapping the
// same link over and over.
export const Route = createFileRoute("/go/$handle/$linkId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const handle = params.handle.toLowerCase();
        if (!/^[a-z0-9_-]{3,32}$/.test(handle) || !/^[A-Za-z0-9-]{8,40}$/.test(params.linkId)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { bioLinksForDisplay } = await import("@/lib/link-in-bio");
        let { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, bio_links, deactivated_at")
          .eq("handle", handle)
          .maybeSingle();
        // Before migration 0028 there's no bio_links column and the read above
        // fails outright; the seller still exists, so send people to their shop.
        if (!profile) {
          const { data: basic } = await supabaseAdmin
            .from("profiles")
            .select("id, deactivated_at")
            .eq("handle", handle)
            .maybeSingle();
          profile = basic ? { ...basic, bio_links: [] } : null;
        }

        const link = profile && !profile.deactivated_at
          ? bioLinksForDisplay(profile.bio_links).find((l) => l.id === params.linkId)
          : undefined;
        // A removed or edited-away link goes back to the seller's page rather
        // than a dead end.
        if (!profile || !link) {
          return new Response(null, {
            status: 302,
            headers: { Location: profile ? `/${handle}` : "/", "Cache-Control": "no-store" },
          });
        }

        const ua = request.headers.get("user-agent");
        const who = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || ua || "unknown";
        if (!isLikelyBot(ua) && !isRateLimited(`link-click:${who}:${link.id}`, 3, 10 * 60 * 1000)) {
          // Best effort: a failed count must never stop the visitor.
          try {
            await supabaseAdmin.from("link_clicks").insert({ profile_id: profile.id, link_id: link.id });
          } catch {
            /* not counted */
          }
        }

        return new Response(null, {
          status: 302,
          headers: { Location: link.url, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
        });
      },
    },
  },
});
