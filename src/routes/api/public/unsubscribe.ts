import { createFileRoute } from "@tanstack/react-router";

// RFC 8058 one-click unsubscribe. Gmail/Yahoo show an Unsubscribe button next
// to the sender and POST here (body: List-Unsubscribe=One-Click) when it's
// pressed. Only POST acts: a GET — a person or a link scanner opening the URL —
// is sent to the confirmation page instead, so prefetching can never
// unsubscribe anyone.
export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") ?? "";
        const { applyUnsubscribe } = await import("@/lib/unsubscribe.server");
        const ok = token ? await applyUnsubscribe(token) : false;
        return new Response(ok ? "Unsubscribed" : "Invalid unsubscribe link", {
          status: ok ? 200 : 400,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
      GET: async ({ request }) => {
        const t = new URL(request.url).searchParams.get("t") ?? "";
        return new Response(null, {
          status: 303,
          headers: { location: `/unsubscribe?t=${encodeURIComponent(t)}` },
        });
      },
    },
  },
});
