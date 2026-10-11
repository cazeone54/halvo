import { createFileRoute } from "@tanstack/react-router";

// Daily storage cleanup, called by a scheduler (e.g. a Railway cron job or
// cron-job.org) with `Authorization: Bearer <CRON_SECRET>`.
//   GET  → report only (what would be removed, who stores the most)
//   POST → also deletes unattached uploads older than 24 hours
// Without CRON_SECRET set, the route refuses everything.
export const Route = createFileRoute("/api/cron/storage-sweep")({
  server: {
    handlers: {
      GET: ({ request }) => run(request, false),
      POST: ({ request }) => run(request, true),
    },
  },
});

async function run(request: Request, apply: boolean): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sweepStorage } = await import("@/lib/storage-sweep.server");
    const report = await sweepStorage(supabaseAdmin, { apply });
    return Response.json({ mode: apply ? "applied" : "dry-run", ...report });
  } catch (error) {
    console.error("Storage sweep failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Sweep failed" }, { status: 500 });
  }
}
