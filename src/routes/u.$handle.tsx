import { createFileRoute, redirect } from "@tanstack/react-router";

// Shops moved to the shorter halvo.io/<handle> (it fits an Instagram bio).
// Every old /u/ link — in bios, posts, emails, search results — keeps working
// with a permanent redirect, which also tells search engines where it went.
export const Route = createFileRoute("/u/$handle")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$handle", params: { handle: params.handle.toLowerCase() }, statusCode: 301 });
  },
});
