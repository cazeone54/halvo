import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { createProductPaymentIntent, recordSuccessfulTransaction } from "@/lib/checkout.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  payWhatYouWant: boolean;
};

export function CheckoutWidget({ product }: { product: Product }) {
  const [amountCents, setAmountCents] = useState(product.priceCents);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createIntentFn = useServerFn(createProductPaymentIntent);

  useEffect(() => {
    setClientSecret(null);
    setError(null);
    createIntentFn({ data: { productId: product.id, amountCents } })
      .then((res) => setClientSecret(res.clientSecret ?? null))
      .catch((e: Error) => setError(e.message));
    // Recreate the intent whenever the pay-what-you-want amount changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, amountCents]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="flex flex-col gap-4">
      {product.payWhatYouWant ? (
        <div>
          <Label>Name your price (min ${(product.priceCents / 100).toFixed(2)})</Label>
          <Input
            type="number"
            min={product.priceCents / 100}
            step="0.01"
            defaultValue={(product.priceCents / 100).toFixed(2)}
            onBlur={(e) => {
              const cents = Math.round(Number(e.target.value) * 100);
              if (cents >= product.priceCents) setAmountCents(cents);
            }}
          />
        </div>
      ) : null}

      {clientSecret ? (
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <PaymentForm productId={product.id} />
        </Elements>
      ) : (
        <p className="text-sm text-muted-foreground">Loading checkout…</p>
      )}
    </div>
  );
}

function PaymentForm({ productId }: { productId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const recordFn = useServerFn(recordSuccessfulTransaction);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { receipt_email: email },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      setError("Payment did not complete.");
      setSubmitting(false);
      return;
    }

    try {
      const { transactionId } = await recordFn({
        data: { paymentIntentId: paymentIntent.id, productId, buyerEmail: email },
      });
      navigate({ to: "/success", search: { id: transactionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record purchase");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <PaymentElement />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : "Pay"}
      </Button>
    </form>
  );
}
