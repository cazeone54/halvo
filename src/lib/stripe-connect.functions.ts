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
      // Platform-side problems (Connect not set up for live, loss liability not
      // accepted in the platform profile) surface here, so log and pass on
      // Stripe's own message instead of a generic "couldn't reach Stripe".
      let account;
      try {
        // Managed Risk: Stripe carries losses on seller accounts, sellers pay
        // Stripe's fees themselves and get the full Stripe Dashboard — the shape
        // direct charges need. The legacy `type: "express"` made the platform the
        // losses collector, which live Stripe now refuses for this platform.
        account = await stripe.accounts.create({
          controller: {
            losses: { payments: "stripe" },
            fees: { payer: "account" },
            requirement_collection: "stripe",
            stripe_dashboard: { type: "full" },
          },
          metadata: { userId: context.userId },
        });
      } catch (error) {
        console.error("Stripe Connect account creation failed:", getStripeErrorMessage(error));
        throw new Error(getStripeErrorMessage(error));
      }
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
    } catch {
      // Stale/foreign account id — self-heal by clearing it.
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
