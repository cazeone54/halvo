// Direct Stripe SDK usage — no gateway/proxy indirection (Kitsly routes every
// call through Lovable's connector-gateway; that's platform-specific and
// doesn't work outside Lovable, so this talks to Stripe's API directly).
import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing environment variable: STRIPE_SECRET_KEY");
  _stripe = new Stripe(key);
  return _stripe;
}

export function getStripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong with the payment.";
}

// Standard SDK-provided signature verification — not a hand-rolled HMAC
// parser like Kitsly's (that existed to work around an edge-runtime
// constraint that doesn't apply here on a Node server).
export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing environment variable: STRIPE_WEBHOOK_SECRET");
  return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
}
