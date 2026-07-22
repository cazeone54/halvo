import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";

export function StripeEmbeddedCheckoutView({ fetchClientSecret }: { fetchClientSecret: () => Promise<string> }) {
  return (
    <div className="rounded-lg border p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
