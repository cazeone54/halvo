import type Stripe from "stripe";
import { isGoneForGood, platformMismatch } from "@/lib/stripe-account-gone";

// Which Stripe account the running STRIPE_SECRET_KEY belongs to. Asked once per
// process: it cannot change without a redeploy, and a seller opening their
// dashboard shouldn't pay for an extra API call.
let cached: string | null | undefined;

export async function platformAccountId(stripe: Stripe): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const account = await stripe.accounts.retrieve();
    cached = account.id ?? null;
  } catch {
    // An unreachable or rejected Stripe says nothing about which account the
    // key belongs to, so treat it as unknown rather than as a mismatch.
    cached = null;
  }
  return cached;
}

/**
 * Whether a seller's stored Stripe connection may be forgotten.
 *
 * Clearing one is destructive and unrecoverable — the seller has to go through
 * Connect onboarding again — so it needs more than Stripe saying "no such
 * account". A key belonging to the wrong Stripe account produces exactly that
 * error for every seller at once, which is how a single mistyped variable can
 * disconnect an entire platform.
 */
export async function safeToForget(error: unknown, stripe: Stripe): Promise<boolean> {
  if (!isGoneForGood(error)) return false;

  const running = await platformAccountId(stripe);
  if (platformMismatch(running)) {
    console.error(
      `Refusing to clear a seller's Stripe connection. STRIPE_SECRET_KEY belongs to ${running}, ` +
        `but STRIPE_PLATFORM_ACCOUNT_ID says this deployment's sellers are connected to ` +
        `${process.env.STRIPE_PLATFORM_ACCOUNT_ID}. The key is wrong, not the sellers — ` +
        `fix the variable and nothing is lost.`,
    );
    return false;
  }
  return true;
}
