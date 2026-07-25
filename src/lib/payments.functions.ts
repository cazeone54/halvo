import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { STRIPE_PRICE_IDS, STRIPE_PRICE_IDS_ANNUAL } from "@/lib/plans";
import { BASE_URL } from "@/lib/site";
import type Stripe from "stripe";

async function resolveOrCreateCustomer(stripe: Stripe, userId: string, email: string | undefined): Promise<string> {
  const existing = await stripe.customers.search({ query: `metadata['userId']:'${userId}'` });
  if (existing.data[0]) return existing.data[0].id;

  if (email) {
    const byEmail = await stripe.customers.list({ email, limit: 1 });
    if (byEmail.data[0]) {
      await stripe.customers.update(byEmail.data[0].id, { metadata: { userId } });
      return byEmail.data[0].id;
    }
  }

  const created = await stripe.customers.create({ email, metadata: { userId } });
  return created.id;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ tier: z.enum(["creator", "pro"]), interval: z.enum(["month", "year"]).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const stripe = getStripeClient();

    const priceId =
      data.interval === "year" ? STRIPE_PRICE_IDS_ANNUAL[data.tier] : STRIPE_PRICE_IDS[data.tier];
    if (!priceId) throw new Error("Annual billing isn't available yet.");

    const { data: existingSub } = await context.supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingSub && (existingSub.status === "active" || existingSub.status === "trialing")) {
      throw new Error("You already have an active subscription. Use the billing portal to change plans.");
    }

    const customerId = await resolveOrCreateCustomer(stripe, context.userId, context.claims.email as string | undefined);

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        ui_mode: "embedded",
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: { metadata: { userId: context.userId } },
        return_url: `${BASE_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      });
      return { clientSecret: session.client_secret };
    } catch (error) {
      throw new Error(getStripeErrorMessage(error));
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_customer_id) {
      throw new Error("No billing account found yet — subscribe to a plan first.");
    }

    const stripe = getStripeClient();
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${BASE_URL}/dashboard`,
      });
      return { url: session.url };
    } catch (error) {
      throw new Error(getStripeErrorMessage(error));
    }
  });
