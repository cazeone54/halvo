import { createFileRoute } from "@tanstack/react-router";

// Is this deployment actually working, and is it running the configuration you
// think it is? Written during the Railway credential rotation of 2026-10-22,
// where a single wrong key took the shop down and three redeploys in a row
// produced the same error — with no way to tell whether the new value had
// reached the server at all.
//
// `uptimeSeconds` is the one that answers that: if it's larger than the time
// since you changed a variable, the server never restarted and whatever you
// typed is still sitting unapplied.
//
// Returns no secrets. Key *prefixes* only ("sk_live_", "sb_secret_"), which
// say which kind of key is loaded without revealing any of it, and errors that
// are already visible to any visitor of /discover.
export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: () => report() } },
});

// "sb_secret_abc123…" -> "sb_secret_". Enough to tell a secret key from a
// publishable one, or a live key from a test key, and nothing more.
function kindOf(value: string | undefined): string {
  if (!value) return "missing";
  const prefix = value.match(/^(sk_live_|sk_test_|pk_live_|pk_test_|sb_secret_|sb_publishable_|re_|eyJ)/)?.[1];
  if (!prefix) return `unrecognised (${value.length} chars)`;
  // A legacy Supabase JWT is worth naming, since the new keys replaced them.
  return prefix === "eyJ" ? "legacy JWT (eyJ…)" : prefix;
}

// Whitespace or quotation marks around a pasted value are the most common way
// a correct key still fails, and they are invisible in a dashboard field.
function looksPasted(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value !== value.trim()) return "has leading or trailing whitespace";
  if (/^["'].*["']$/.test(value)) return "is wrapped in quotation marks";
  return undefined;
}

async function report(): Promise<Response> {
  const checks: Record<string, unknown> = {
    uptimeSeconds: Math.round(process.uptime()),
    supabaseUrl: process.env.SUPABASE_URL?.replace(/^https?:\/\//, "") ?? "missing",
    supabaseServiceKey: kindOf(process.env.SUPABASE_SERVICE_ROLE_KEY),
    stripeSecretKey: kindOf(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? "set" : "missing",
    resendKey: kindOf(process.env.RESEND_API_KEY),
    emailFrom: process.env.EMAIL_FROM_ADDRESS ?? "missing (would use Resend's sandbox sender)",
  };

  for (const [name, value] of [
    ["supabaseServiceKey", process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["stripeSecretKey", process.env.STRIPE_SECRET_KEY],
  ] as const) {
    const problem = looksPasted(value);
    if (problem) checks[`${name}Warning`] = problem;
  }

  // Does the key actually work? Counting one row is the cheapest honest answer.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("products").select("id", { count: "exact", head: true });
    checks.database = error ? `FAILING: ${error.message}` : "ok";
  } catch (error) {
    checks.database = `FAILING: ${error instanceof Error ? error.message : "unknown"}`;
  }

  // Same for Stripe: retrieving the account the key belongs to touches no money
  // and no connected account, fails loudly on a wrong or expired key, and
  // answers the question that matters here — WHICH Stripe account is this?
  //
  // Halvo has two: the halvo.io platform and a seller account that sells on it.
  // Their keys are indistinguishable by eye, and putting the seller's key here
  // makes every seller look disconnected. So say plainly whose key is loaded.
  try {
    const { getStripeClient } = await import("@/lib/stripe.server");
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve();
    const id = account.id ?? "";
    const name = account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? "(unnamed)";
    checks.stripe = "ok";
    checks.stripeAccount = `${id.slice(0, 9)}…${id.slice(-4)} — ${name}`;

    const expected = process.env.STRIPE_PLATFORM_ACCOUNT_ID?.trim();
    if (!expected) {
      checks.stripeAccountCheck = "STRIPE_PLATFORM_ACCOUNT_ID not set — a key from the wrong Stripe account would go unnoticed";
    } else if (expected !== id) {
      checks.stripeAccountCheck = "WRONG ACCOUNT — this key is not the platform these sellers are connected to";
    } else {
      checks.stripeAccountCheck = "matches STRIPE_PLATFORM_ACCOUNT_ID";
    }
  } catch (error) {
    checks.stripe = `FAILING: ${error instanceof Error ? error.message : "unknown"}`;
  }

  const healthy = checks.database === "ok" && checks.stripe === "ok";
  return Response.json({ healthy, ...checks }, { status: healthy ? 200 : 503 });
}
