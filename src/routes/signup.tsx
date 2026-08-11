import { createFileRoute, redirect } from "@tanstack/react-router";

// Halvo has one passwordless auth page that both signs up and signs in, so
// /signup just points there — no bare 404 for anyone who guesses the URL or
// follows an old link.
export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
