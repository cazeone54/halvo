import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeErrorMessage } from "@/lib/stripe.server";
import { BASE_URL } from "@/lib/site";

export const startStripeConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripeClient } = await import("@/lib/stripe.server");
    const stripe = getStripeClient();

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", context.userId)
      .single();

    let accountId = profile?.stripe_connect_id ?? null;

    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch {
        accountId = null;
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { userId: context.userId },
      });
      accountId = account.id;

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
      throw new Error(getStripeErrorMessage(error));
    }
  });

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
      return {
        connected: true,
        chargesEnabled: !!account.charges_enabled,
        detailsSubmitted: !!account.details_submitted,
        payoutsEnabled: !!account.payouts_enabled,
        requirementsDue,
      };
    } catch {
      // Stale/foreign account id — self-heal by clearing it.
      await context.supabase.from("profiles").update({ stripe_connect_id: null }).eq("id", context.userId);
      return {
        connected: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
      };
    }
  });
