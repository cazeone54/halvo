import { createFileRoute } from "@tanstack/react-router";

// One-time reminders to sellers who stopped part-way (seller-nudge.ts). The
// server process calls this once an hour (see server.mjs); it can also be
// called by any scheduler with `Authorization: Bearer <CRON_SECRET>`.
//   GET  → dry run: who would get which reminder, nothing claimed or sent
//   POST → claims and sends them (only once SELLER_NUDGES_LIVE is on)
// Without CRON_SECRET set, the route refuses everything.
export const Route = createFileRoute("/api/cron/seller-nudges")({
  server: {
    handlers: {
      GET: ({ request }) => run(request, true),
      POST: ({ request }) => run(request, false),
    },
  },
});

async function run(request: Request, dryRun: boolean): Promise<Response> {
  const { isCronAuthorized } = await import("@/lib/cron-auth");
  if (!(await isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { runSellerNudges } = await import("@/lib/seller-nudge.server");
    return Response.json(await runSellerNudges({ dryRun }));
  } catch (error) {
    console.error("Seller reminder run failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Run failed" }, { status: 500 });
  }
}
