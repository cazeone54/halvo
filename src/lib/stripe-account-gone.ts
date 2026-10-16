// True when live Stripe reports a seller's connected account no longer exists
// or no longer belongs to this platform: the only case where forgetting the
// stored account id is right. A test-mode server can't see live accounts and a
// Stripe outage or timeout says nothing about the account, so neither counts.
export function isGoneForGood(error: unknown, secretKey = process.env.STRIPE_SECRET_KEY): boolean {
  if (!secretKey?.startsWith("sk_live_")) return false;
  const e = error as { code?: string; type?: string } | null;
  return e?.code === "resource_missing" || e?.code === "account_invalid" || e?.type === "StripePermissionError";
}
