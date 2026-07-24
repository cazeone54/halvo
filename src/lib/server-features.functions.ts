import { createServerFn } from "@tanstack/react-start";

// Which optional integrations are actually configured on this deployment.
// The dashboard uses this to hide features that would otherwise be visible,
// clickable, and then fail — a new seller clicking "Generate with AI" and
// getting an error is a terrible first impression of a headline feature.
// Only booleans are returned; no key material ever reaches the client.
export const getServerFeatures = createServerFn({ method: "GET" }).handler(async () => {
  return {
    ai: !!process.env.ANTHROPIC_API_KEY,
    email: !!process.env.RESEND_API_KEY,
  };
});
