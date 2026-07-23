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
import { applyCouponPreview } from "@/lib/coupons.functions";
import { getActiveReferralCode } from "@/lib/referral-attribution";
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
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountedAmountCents: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createIntentFn = useServerFn(createProductPaymentIntent);
  const previewCouponFn = useServerFn(applyCouponPreview);

  useEffect(() => {
    setClientSecret(null);
    setError(null);
    createIntentFn({ data: { productId: product.id, amountCents, couponCode: appliedCoupon?.code } })
      .then((res) => setClientSecret(res.clientSecret ?? null))
      .catch((e: Error) => setError(e.message));
    // Recreate the intent whenever the pay-what-you-want amount or applied coupon changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, amountCents, appliedCoupon?.code]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await previewCouponFn({
        data: { code: couponCode.trim(), productId: product.id, amountCents },
      });
      setAppliedCoupon({ code: couponCode.trim(), discountedAmountCents: res.discountedAmountCents });
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : "Invalid coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  const displayAmountCents = appliedCoupon?.discountedAmountCents ?? amountCents;

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

      <div>
        <Label>Coupon code</Label>
        <div className="flex gap-2">
          <Input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Optional"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={!!appliedCoupon}
          />
          {appliedCoupon ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAppliedCoupon(null);
                setCouponCode("");
              }}
            >
              Remove
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponLoading}>
              Apply
            </Button>
          )}
        </div>
        {couponError ? <p className="mt-1 text-sm text-destructive">{couponError}</p> : null}
        {appliedCoupon ? (
          <p className="mt-1 text-sm text-muted-foreground">
            New total: <span className="font-medium text-foreground">${(displayAmountCents / 100).toFixed(2)}</span>
          </p>
        ) : null}
      </div>

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
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !acknowledged) return;
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
        data: {
          paymentIntentId: paymentIntent.id,
          productId,
          buyerEmail: email,
          referralCode: getActiveReferralCode() ?? undefined,
          acknowledgedTerms: acknowledged,
        },
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
        <Input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <PaymentElement />
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>
          I understand this is a digital product delivered instantly, and I agree that all sales are final once
          I download it.
        </span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={!stripe || submitting || !acknowledged}>
        {submitting ? "Processing…" : "Pay"}
      </Button>
    </form>
  );
}
