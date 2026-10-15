import type Stripe from "stripe";
import { getStripeErrorMessage } from "@/lib/stripe.server";
import type { SellerCountry } from "@/lib/seller-countries";

// Stripe API version for the Accounts v2 call only. The rest of Halvo keeps
// using v1 (the SDK's pinned version) on these accounts: reading status, the
// onboarding link and direct charges all work unchanged on a v2-created account.
const ACCOUNTS_V2_VERSION = "2026-09-30.endive";

/**
 * Creates the seller's connected Stripe account and returns its id.
 *
 * The account matches what Halvo has always created: Stripe carries losses
 * (Managed Risk), the seller pays Stripe's fees, and gets the full Stripe
 * Dashboard. Two things changed in October 2026:
 *  - Stripe stopped accepting v1 account creation for new Connect platforms
 *    (seen in test mode first), so Accounts v2 is tried first and v1 is only
 *    the fallback.
 *  - The seller's country is passed explicitly. Without it Stripe uses the
 *    platform's country, so a seller in the US or UK got a Bulgarian account
 *    they couldn't complete with their own ID and bank.
 */
export async function createSellerAccount(
  stripe: Stripe,
  opts: { country: SellerCountry; email?: string | null; userId: string },
): Promise<string> {
  let v2Error: string | null = null;
  try {
    const res = await fetch("https://api.stripe.com/v2/core/accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Stripe-Version": ACCOUNTS_V2_VERSION,
      },
      body: JSON.stringify({
        ...(opts.email ? { contact_email: opts.email } : {}),
        dashboard: "full",
        identity: { country: opts.country.toLowerCase() },
        defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        metadata: { userId: opts.userId },
      }),
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (res.ok && json.id) return json.id;
    v2Error = json.error?.message ?? `Stripe returned ${res.status}`;
  } catch (error) {
    v2Error = error instanceof Error ? error.message : "Couldn't reach Stripe";
  }

  console.error("Stripe Accounts v2 creation failed, trying v1:", v2Error);
  try {
    const account = await stripe.accounts.create({
      country: opts.country,
      ...(opts.email ? { email: opts.email } : {}),
      controller: {
        losses: { payments: "stripe" },
        fees: { payer: "account" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "full" },
      },
      metadata: { userId: opts.userId },
    });
    return account.id;
  } catch (error) {
    console.error("Stripe Accounts v1 creation failed too:", getStripeErrorMessage(error));
    // v2 is the path Stripe wants used, so its reason is the useful one to show.
    throw new Error(v2Error ?? getStripeErrorMessage(error));
  }
}
