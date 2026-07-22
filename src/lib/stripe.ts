import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | undefined;

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) throw new Error("Missing environment variable: VITE_STRIPE_PUBLISHABLE_KEY");
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export function isTestMode(): boolean {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  return !!key?.startsWith("pk_test_");
}
