import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { createProductPaymentIntent, recordSuccessfulTransaction } from "@/lib/checkout.functions";
import { claimFreeProduct } from "@/lib/free-claim.functions";
import { getProductBump } from "@/lib/bumps.functions";
import { isFreeProduct } from "@/lib/checkout-math";
import { useQuery } from "@tanstack/react-query";
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

// Read once, at module scope on the client, because document.referrer is only
// meaningful for the page the buyer actually landed on — any in-app navigation
// before checkout would otherwise overwrite it with one of our own URLs.
function captureArrival(): { referrer?: string; utmSource?: string } {
  if (typeof window === "undefined") return {};
  const utmSource = new URLSearchParams(window.location.search).get("utm_source") ?? undefined;
  return { referrer: document.referrer || undefined, utmSource: utmSource || undefined };
}

// A free product skips Stripe entirely — no payment form, no card, and the
// seller doesn't need Connect onboarding finished for it to work.
function FreeClaimForm({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const claimFn = useServerFn(claimFreeProduct);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { transactionId } = await claimFn({
        data: { productId, buyerEmail: email, ...captureArrival() },
      });
      navigate({ to: "/success", search: { id: transactionId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get your download");
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
        <p className="mt-1 text-xs text-muted-foreground">We'll send your download link here too.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Getting it…" : "Get it free"}
      </Button>
    </form>
  );
}

export function CheckoutWidget({ product }: { product: Product }) {
  const [amountCents, setAmountCents] = useState(product.priceCents);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountedAmountCents: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bumpTaken, setBumpTaken] = useState(false);
  const createIntentFn = useServerFn(createProductPaymentIntent);
  const previewCouponFn = useServerFn(applyCouponPreview);
  const bumpFn = useServerFn(getProductBump);
  const free = isFreeProduct({ price_cents: product.priceCents, pay_what_you_want: product.payWhatYouWant });

  const bumpQ = useQuery({
    queryKey: ["product-bump", product.id],
    queryFn: () => bumpFn({ data: { productId: product.id } }),
    enabled: !free,
  });
  const bump = bumpQ.data;

  useEffect(() => {
    if (free) return; // nothing to charge, so never create a PaymentIntent
    setClientSecret(null);
    setError(null);
    // The referral code and bump both go in at intent time — that's where the
    // affiliate commission is withheld and where the bump price is resolved.
    createIntentFn({
      data: {
        productId: product.id,
        amountCents,
        couponCode: appliedCoupon?.code,
        referralCode: getActiveReferralCode() ?? undefined,
        bumpTaken,
      },
    })
      .then((res) => setClientSecret(res.clientSecret ?? null))
      .catch((e: Error) => setError(e.message));
    // Recreate the intent whenever amount, coupon or the bump selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, amountCents, appliedCoupon?.code, free, bumpTaken]);

  // Warm Stripe.js immediately, in parallel with creating the PaymentIntent, so
  // the payment form mounts the instant the client secret arrives instead of
  // only then starting to download the Stripe SDK.
  useEffect(() => {
    if (!free) void getStripe();
  }, [free]);

  if (free) return <FreeClaimForm productId={product.id} />;

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

  // A buyer landing on a not-yet-ready product should see a calm notice, not a
  // raw red error string where the payment form belongs.
  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-center">
        <p className="text-sm font-medium">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">Check back soon.</p>
      </div>
    );
  }

  const baseAmountCents = appliedCoupon?.discountedAmountCents ?? amountCents;
  const displayAmountCents = baseAmountCents + (bumpTaken && bump ? bump.priceCents : 0);

  return (
    <div className="flex flex-col gap-4">
      {product.payWhatYouWant ? (
        <div>
          <Label>Name your price (min ${(product.priceCents / 100).toFixed(2)})</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={product.priceCents / 100}
            step="0.01"
            defaultValue={(product.priceCents / 100).toFixed(2)}
            onBlur={(e) => {
              // Clamp up to the minimum and write it back, so the field never
              // shows an amount we won't actually charge. Updating on blur (not
              // on every keystroke) avoids recreating the PaymentIntent midway
              // through typing.
              const raw = Math.round(Number(e.target.value) * 100);
              const clamped = Number.isFinite(raw) && raw >= product.priceCents ? raw : product.priceCents;
              setAmountCents(clamped);
              e.target.value = (clamped / 100).toFixed(2);
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

      {bump ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={bumpTaken}
            onChange={(e) => setBumpTaken(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
              Add {bump.name}
              <span className="text-primary">+${(bump.priceCents / 100).toFixed(2)}</span>
            </span>
            {bump.description ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">{bump.description}</span>
            ) : null}
          </span>
        </label>
      ) : null}

      {clientSecret ? (
        // locale:"en" pins the Stripe/Link widgets to English so they match the
        // site UI (they otherwise follow the browser's language).
        <Elements
          stripe={getStripe()}
          options={{ clientSecret, appearance: { theme: "stripe" }, locale: "en" }}
        >
          <PaymentForm productId={product.id} amountCents={displayAmountCents} />
        </Elements>
      ) : (
        <CheckoutSkeleton />
      )}
    </div>
  );
}

// A shaped placeholder while the PaymentIntent + Stripe.js load, so the wait
// reads as "loading the form" rather than a broken "Loading checkout…" line.
function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading secure checkout">
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="mt-1 h-11 w-full animate-pulse rounded-md bg-muted" />
      <span className="sr-only">Loading secure checkout…</span>
    </div>
  );
}

function PaymentForm({ productId, amountCents }: { productId: string; amountCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const recordFn = useServerFn(recordSuccessfulTransaction);
  const [email, setEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The payment succeeded at Stripe but we couldn't hand the buyer their
  // download link (a transient error recording the order). The server-side
  // webhook still records the sale and emails the link, so this is NOT a
  // failure the buyer should retry — reassure them instead of re-arming Pay.
  const [paidPendingDelivery, setPaidPendingDelivery] = useState(false);

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

    // From here on the buyer HAS been charged. A retry (with a one-off retry
    // for a flaky connection) gets them to /success; if it still fails, we
    // show the reassurance panel rather than an alarming error + Pay button.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { transactionId } = await recordFn({
          data: {
            paymentIntentId: paymentIntent.id,
            productId,
            buyerEmail: email,
            referralCode: getActiveReferralCode() ?? undefined,
            acknowledgedTerms: acknowledged,
            ...captureArrival(),
          },
        });
        navigate({ to: "/success", search: { id: transactionId } });
        return;
      } catch {
        if (attempt === 0) continue;
        setPaidPendingDelivery(true);
        setSubmitting(false);
      }
    }
  };

  if (paidPendingDelivery) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
        <p className="text-sm font-medium">Payment received — you're all set.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We're emailing your download link to <span className="font-medium text-foreground">{email}</span> now.
          It can take a minute to arrive; check your spam folder if you don't see it.
        </p>
      </div>
    );
  }

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
      <Button type="submit" size="lg" disabled={!stripe || submitting || !acknowledged}>
        {submitting ? "Processing…" : `Pay $${(amountCents / 100).toFixed(2)}`}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Payments are secure and encrypted
      </p>
    </form>
  );
}
