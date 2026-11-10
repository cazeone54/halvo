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
  opts: {
    country: SellerCountry;
    email?: string | null;
    userId: string;
    // Pre-filled on Stripe's onboarding so its first screen asks less (see
    // stripe-prefill.ts). The seller can still change both there.
    profile?: { businessUrl: string | null; productDescription: string };
  },
): Promise<string> {
  const createV2 = async (withProfile: boolean): Promise<{ id: string | null; error: string | null }> => {
    try {
      const profile =
        withProfile && opts.profile
          ? {
              ...(opts.profile.businessUrl ? { business_url: opts.profile.businessUrl } : {}),
              product_description: opts.profile.productDescription,
            }
          : null;
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
          defaults: {
            responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
            ...(profile ? { profile } : {}),
          },
          configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
          metadata: { userId: opts.userId },
        }),
      });
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (res.ok && json.id) return { id: json.id, error: null };
      return { id: null, error: json.error?.message ?? `Stripe returned ${res.status}` };
    } catch (error) {
      return { id: null, error: error instanceof Error ? error.message : "Couldn't reach Stripe" };
    }
  };

  let v2 = await createV2(true);
  if (v2.id) return v2.id;
  // A pre-filled value Stripe won't take (say, a website it can't reach) must
  // never stop the account being made: try once more without them.
  if (opts.profile) {
    console.error("Stripe account with pre-filled profile refused, retrying without it:", v2.error);
    v2 = await createV2(false);
    if (v2.id) return v2.id;
  }
  const v2Error = v2.error;

  console.error("Stripe Accounts v2 creation failed, trying v1:", v2Error);
  const createV1 = (withProfile: boolean) =>
    stripe.accounts.create({
      country: opts.country,
      ...(opts.email ? { email: opts.email } : {}),
      ...(withProfile && opts.profile
        ? {
            business_profile: {
              ...(opts.profile.businessUrl ? { url: opts.profile.businessUrl } : {}),
              product_description: opts.profile.productDescription,
            },
          }
        : {}),
      controller: {
        losses: { payments: "stripe" },
        fees: { payer: "account" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "full" },
      },
      metadata: { userId: opts.userId },
    });
  try {
    try {
      return (await createV1(true)).id;
    } catch (error) {
      if (!opts.profile) throw error;
      console.error("Stripe v1 account with pre-filled profile refused, retrying without it:", getStripeErrorMessage(error));
      return (await createV1(false)).id;
    }
  } catch (error) {
    console.error("Stripe Accounts v1 creation failed too:", getStripeErrorMessage(error));
    // v2 is the path Stripe wants used, so its reason is the useful one to show.
    throw new Error(v2Error ?? getStripeErrorMessage(error));
  }
}
