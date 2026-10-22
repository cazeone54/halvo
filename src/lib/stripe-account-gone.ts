// True when live Stripe reports a seller's connected account no longer exists
// or no longer belongs to this platform: the only case where forgetting the
// stored account id is right. A test-mode server can't see live accounts and a
// Stripe outage or timeout says nothing about the account, so neither counts.
export function isGoneForGood(error: unknown, secretKey = process.env.STRIPE_SECRET_KEY): boolean {
  if (!secretKey?.startsWith("sk_live_")) return false;
  const e = error as { code?: string; type?: string } | null;
  return e?.code === "resource_missing" || e?.code === "account_invalid" || e?.type === "StripePermissionError";
}

// Halvo has two Stripe accounts: the halvo.io platform, and a seller account
// that sells on it. They look identical in a dashboard and their keys are
// interchangeable to the naked eye.
//
// Put the seller's key in STRIPE_SECRET_KEY and every connected account becomes
// `resource_missing` — not because the sellers left, but because they were
// never connected to *that* account. isGoneForGood then reads a wrong key as
// "they all disconnected" and clears stripe_connect_id for each seller who
// opens their dashboard. That is unrecoverable without re-onboarding every one
// of them, and it happened once already.
//
// So: name the platform the connections belong to. When STRIPE_PLATFORM_ACCOUNT_ID
// is set and the running key belongs to a different account, nothing is ever
// cleared — the deployment is misconfigured, and the sellers are fine.
export function platformMismatch(
  keyAccountId: string | null | undefined,
  expected = process.env.STRIPE_PLATFORM_ACCOUNT_ID,
): boolean {
  if (!expected?.trim() || !keyAccountId) return false;
  return keyAccountId.trim() !== expected.trim();
}
