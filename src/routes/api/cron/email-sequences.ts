import { createFileRoute } from "@tanstack/react-router";

// Follow-up emails after free downloads. The server process calls this once an
// hour (see server.mjs); it can also be called by any scheduler with
// `Authorization: Bearer <CRON_SECRET>`.
//   GET  → dry run: how many emails are due, nothing claimed or sent
//   POST → claims and sends them
// Without CRON_SECRET set, the route refuses everything.
export const Route = createFileRoute("/api/cron/email-sequences")({
  server: {
    handlers: {
      GET: ({ request }) => run(request, true),
      POST: ({ request }) => run(request, false),
    },
  },
});

async function run(request: Request, dryRun: boolean): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try {
    const { runEmailSequences } = await import("@/lib/email-sequence.server");
    return Response.json(await runEmailSequences({ dryRun }));
  } catch (error) {
    console.error("Email sequence run failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Run failed" }, { status: 500 });
  }
}
