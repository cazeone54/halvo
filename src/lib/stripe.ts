import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Cached per connected account. A direct-charge client secret only confirms if
// Stripe.js was initialised in that account's context, and the platform-context
// instance can't be reused for it — so they're kept separate rather than one
// module-level singleton.
const stripePromises = new Map<string, Promise<Stripe | null>>();

export function getStripe(stripeAccount?: string | null) {
  const cacheKey = stripeAccount || "platform";
  let promise = stripePromises.get(cacheKey);
  if (!promise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) throw new Error("Missing environment variable: VITE_STRIPE_PUBLISHABLE_KEY");
    promise = stripeAccount ? loadStripe(key, { stripeAccount }) : loadStripe(key);
    stripePromises.set(cacheKey, promise);
  }
  return promise;
}

export function isTestMode(): boolean {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  return !!key?.startsWith("pk_test_");
}
