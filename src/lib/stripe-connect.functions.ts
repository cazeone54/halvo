import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeErrorMessage } from "@/lib/stripe.server";
import { createSellerAccount } from "@/lib/stripe-seller-account.server";
import { isSellerCountry } from "@/lib/seller-countries";
import { isGoneForGood } from "@/lib/stripe-account-gone";
import { BASE_URL } from "@/lib/site";

export const startStripeConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // The country is needed only the first time, when the account is created
  // (a seller finishing setup, or the refresh page, sends none).
  .validator((data) =>
    z
      .object({ country: z.string().refine(isSellerCountry, "Choose a country from the list.").optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getStripeClient } = await import("@/lib/stripe.server");
    const stripe = getStripeClient();

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", context.userId)
      .single();

    let accountId = profile?.stripe_connect_id ?? null;

    // A stored account is replaced only if live Stripe says it's gone; on any
    // other error (an outage, test keys) the seller keeps their real account
    // and sees Stripe's message instead.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (error) {
        if (!isGoneForGood(error)) throw new Error(getStripeErrorMessage(error));
        accountId = null;
      }
    }

    if (!accountId) {
      // Stripe fixes an account's country at creation, so ask rather than let it
      // default to the platform's (Bulgaria).
      if (!data.country || !isSellerCountry(data.country)) {
        throw new Error("Choose the country you live in, or where your business is registered.");
      }
      // Platform-side problems surface here, and createSellerAccount passes on
      // Stripe's own message instead of a generic "couldn't reach Stripe".
      const claims = context.claims as { email?: unknown } | undefined;
      accountId = await createSellerAccount(stripe, {
        country: data.country,
        email: typeof claims?.email === "string" ? claims.email : null,
        userId: context.userId,
      });

      const { error: updateError } = await context.supabase
        .from("profiles")
        .update({ stripe_connect_id: accountId })
        .eq("id", context.userId);
      if (updateError) throw new Error(updateError.message);
    }

    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${BASE_URL}/dashboard/stripe/refresh`,
        return_url: `${BASE_URL}/dashboard/stripe/return`,
        type: "account_onboarding",
      });
      return { url: accountLink.url };
    } catch (error) {
      console.error("Stripe Connect onboarding link failed:", getStripeErrorMessage(error));
      throw new Error(getStripeErrorMessage(error));
    }
  });

// Public listings only show a seller's paid products once they can take
// payments (seller-visibility.server.ts), so the stored flag follows what Stripe
// says each time the seller's dashboard checks. Written with the service role:
// a database trigger stops sellers setting it on their own profile. Best-effort,
// and a no-op write when nothing changed; before migration 0024 the column
// doesn't exist and the error is ignored.
async function syncChargesEnabled(userId: string, enabled: boolean): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_charges_enabled: enabled })
      .eq("id", userId)
      .neq("stripe_charges_enabled", enabled);
  } catch {
    // Listings keep the last known value until the next check.
  }
}

export const getStripeConnectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripeClient } = await import("@/lib/stripe.server");
    const stripe = getStripeClient();

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", context.userId)
      .single();

    if (!profile?.stripe_connect_id) {
      await syncChargesEnabled(context.userId, false);
      return {
        connected: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
      };
    }

    try {
      const account = await stripe.accounts.retrieve(profile.stripe_connect_id);
      // `currently_due` is what Stripe is blocking on right now; `past_due` is
      // the overdue subset. Both are things the seller has to supply, so they
      // get surfaced together — see stripe-requirements.ts.
      const requirementsDue = Array.from(
        new Set([...(account.requirements?.currently_due ?? []), ...(account.requirements?.past_due ?? [])]),
      );
      await syncChargesEnabled(context.userId, !!account.charges_enabled);
      return {
        connected: true,
        chargesEnabled: !!account.charges_enabled,
        detailsSubmitted: !!account.details_submitted,
        payoutsEnabled: !!account.payouts_enabled,
        requirementsDue,
      };
    } catch (error) {
      // Only an account Stripe says doesn't exist (or that disconnected Halvo)
      // is cleared, and only with live keys: a test-mode server can't see live
      // accounts, and a Stripe outage or timeout says nothing about the
      // account. Clearing on those once disconnected a live seller and hid
      // their products. Otherwise the stored connection is kept as it is.
      if (!isGoneForGood(error)) {
        return {
          connected: true,
          chargesEnabled: false,
          detailsSubmitted: false,
          payoutsEnabled: false,
          requirementsDue: [] as string[],
          unavailable: true,
        };
      }
      await context.supabase.from("profiles").update({ stripe_connect_id: null }).eq("id", context.userId);
      await syncChargesEnabled(context.userId, false);
      return {
        connected: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
      };
    }
  });
