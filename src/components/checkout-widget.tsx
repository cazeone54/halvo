import { useState, useEffect, useId } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { createProductPaymentIntent, recordSuccessfulTransaction } from "@/lib/checkout.functions";
import { claimFreeProduct } from "@/lib/free-claim.functions";
import { getProductBump } from "@/lib/bumps.functions";
import { isFreeProduct } from "@/lib/checkout-math";
import { useQuery } from "@tanstack/react-query";
import { applyCouponPreview } from "@/lib/coupons.functions";
import { getActiveReferralCode } from "@/lib/referral-attribution";
import { createSubscriptionCheckout, recordSubscriptionPurchase } from "@/lib/recurring.functions";
import { GRACE_DAYS, installmentAmountCents, intervalLabel } from "@/lib/recurring";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  payWhatYouWant: boolean;
  billingType?: "one_time" | "membership";
  billingInterval?: "month" | "year";
  installmentCount?: number | null;
};

// "full" = one payment; the other two are Stripe subscriptions.
type Plan = "full" | "installments" | "membership";

// What the buyer agrees to — shown on the checkbox that gates payment.
export type PlanTerms = { kind: "full" } | { kind: "membership"; label: string } | { kind: "installments"; label: string };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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
  const uid = useId();
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
        <Label htmlFor={`${uid}-f1`}>Email</Label>
        <Input id={`${uid}-f1`}
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
  const uid = useId();
  const isMembership = product.billingType === "membership";
  const installments = !isMembership && product.installmentCount ? product.installmentCount : null;
  const [plan, setPlan] = useState<Plan>(isMembership ? "membership" : "full");
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(product.priceCents);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountedAmountCents: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chargedCents, setChargedCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bumpTaken, setBumpTaken] = useState(false);
  const createIntentFn = useServerFn(createProductPaymentIntent);
  const createSubFn = useServerFn(createSubscriptionCheckout);
  const previewCouponFn = useServerFn(applyCouponPreview);
  const bumpFn = useServerFn(getProductBump);
  const free = isFreeProduct({ price_cents: product.priceCents, pay_what_you_want: product.payWhatYouWant });

  const bumpQ = useQuery({
    queryKey: ["product-bump", product.id],
    queryFn: () => bumpFn({ data: { productId: product.id } }),
    enabled: !free && !isMembership,
  });
  // Coupons, order bumps and name-your-price apply to single payments only.
  const bump = plan === "full" ? bumpQ.data : null;

  useEffect(() => {
    if (free) return; // nothing to charge, so never create a PaymentIntent
    setClientSecret(null);
    setChargedCents(null);
    setSubscriptionId(null);
    setError(null);
    if (plan !== "full") {
      createSubFn({ data: { productId: product.id, plan } })
        .then((res) => {
          setChargedCents(res.amountCents);
          setSubscriptionId(res.subscriptionId);
          setClientSecret(res.clientSecret);
        })
        .catch((e: Error) => setError(e.message));
      return;
    }
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
      .then((res) => {
        setChargedCents(res.amountCents);
        setClientSecret(res.clientSecret ?? null);
      })
      .catch((e: Error) => setError(e.message));
    // Recreate the intent whenever amount, coupon or the bump selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, amountCents, appliedCoupon?.code, free, bumpTaken, plan]);

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
        {plan === "installments" ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setPlan("full")}>
            Pay in full instead
          </Button>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Check back soon.</p>
        )}
      </div>
    );
  }

  const installmentCents = installments ? installmentAmountCents(product.priceCents, installments) : 0;
  const terms: PlanTerms =
    plan === "membership"
      ? {
          kind: "membership",
          label: `${money(product.priceCents)} every ${intervalLabel(product.billingInterval ?? "month")}`,
        }
      : plan === "installments" && installments
        ? { kind: "installments", label: `${installments} monthly payments of ${money(installmentCents)}` }
        : { kind: "full" };

  const baseAmountCents = appliedCoupon?.discountedAmountCents ?? amountCents;
  // Once the payment exists, show exactly what it will charge (e.g. if a launch
  // price ended while the page was open).
  const displayAmountCents = chargedCents ?? baseAmountCents + (bumpTaken && bump ? bump.priceCents : 0);

  return (
    <div className="flex flex-col gap-4">
      {installments ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">How would you like to pay?</legend>
          {(
            [
              { value: "full", title: "Pay in full", detail: money(product.priceCents) },
              {
                value: "installments",
                title: `${installments} monthly payments`,
                detail: `${money(installmentCents)} today, then ${money(installmentCents)}/month · ${money(
                  installmentCents * installments,
                )} total`,
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                plan === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name={`plan-${product.id}`}
                value={opt.value}
                checked={plan === opt.value}
                onChange={() => setPlan(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="block text-xs text-muted-foreground">{opt.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {plan === "full" && product.payWhatYouWant ? (
        <div>
          <Label htmlFor={`${uid}-f2`}>Name your price (min ${(product.priceCents / 100).toFixed(2)})</Label>
          <Input id={`${uid}-f2`}
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

      {plan === "full" ? (
      <div>
        <Label htmlFor={`${uid}-coupon`}>Coupon code</Label>
        <div className="flex gap-2">
          <Input
            id={`${uid}-coupon`}
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
      ) : null}

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
          <PaymentForm
            productId={product.id}
            amountCents={displayAmountCents}
            subscriptionId={subscriptionId}
            terms={terms}
          />
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

function PaymentForm({
  productId,
  amountCents,
  subscriptionId,
  terms,
}: {
  productId: string;
  amountCents: number;
  subscriptionId: string | null;
  terms: PlanTerms;
}) {
  const uid = useId();
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const recordFn = useServerFn(recordSuccessfulTransaction);
  const recordSubFn = useServerFn(recordSubscriptionPurchase);
  const [email, setEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackNudge, setAckNudge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once Stripe reports at least one wallet (Apple Pay, Google Pay, Link)
  // on this device. Until then the express row renders nothing visible.
  const [expressAvailable, setExpressAvailable] = useState(false);
  // The payment succeeded at Stripe but we couldn't hand the buyer their
  // download link (a transient error recording the order). The server-side
  // webhook still records the sale and emails the link, so this is NOT a
  // failure the buyer should retry — reassure them instead of re-arming Pay.
  // Holds the email the link is going to, since a wallet buyer never typed one.
  const [paidPendingDelivery, setPaidPendingDelivery] = useState<string | null>(null);

  // Shared by the card form and the express wallets: from here on the buyer
  // HAS been charged. One retry for a flaky connection gets them to /success;
  // if it still fails, show the reassurance panel rather than an alarming
  // error next to a re-armed Pay button.
  const finishPurchase = async (paymentIntentId: string, buyerEmail: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { transactionId } = subscriptionId
          ? await recordSubFn({
              data: { subscriptionId, productId, buyerEmail, acknowledgedTerms: acknowledged, ...captureArrival() },
            })
          : await recordFn({
              data: {
                paymentIntentId,
                productId,
                buyerEmail,
                referralCode: getActiveReferralCode() ?? undefined,
                acknowledgedTerms: acknowledged,
                ...captureArrival(),
              },
            });
        navigate({ to: "/success", search: { id: transactionId } });
        return;
      } catch {
        if (attempt === 0) continue;
        setPaidPendingDelivery(buyerEmail);
        setSubmitting(false);
      }
    }
  };

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
    await finishPurchase(paymentIntent.id, email);
  };

  // Wallet payments confirm the same PaymentIntent as the card form. No
  // elements.submit() here: that validates the (empty) card fields and would
  // reject a perfectly good Apple Pay payment.
  const handleExpressConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;
    const walletEmail = event.billingDetails?.email ?? "";
    if (!walletEmail) {
      event.paymentFailed({ reason: "fail" });
      setError("Your wallet didn't share an email address — please pay by card below instead.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { receipt_email: walletEmail },
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
    await finishPurchase(paymentIntent.id, walletEmail);
  };

  if (paidPendingDelivery !== null) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
        <p className="text-sm font-medium">Payment received — you're all set.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We're emailing your download link to{" "}
          <span className="font-medium text-foreground">{paidPendingDelivery}</span> now. It can take a minute to
          arrive; check your spam folder if you don't see it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* First, because it gates BOTH ways to pay — the recorded final-sale
          acknowledgement is part of the chargeback defense, so a one-tap
          wallet must not skip it. */}
      <label
        className={`flex items-start gap-2 rounded-md text-sm text-muted-foreground transition-shadow ${
          ackNudge ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <input
          id="final-sale-ack"
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          checked={acknowledged}
          onChange={(e) => {
            setAcknowledged(e.target.checked);
            setAckNudge(false);
          }}
        />
        <span>
          {terms.kind === "membership" ? (
            <>
              I agree to be charged {terms.label} until I cancel. I can cancel any time from the billing link in my
              email, and keep access to the end of the period I've paid for. I want access to start immediately and
              understand that I lose my 14-day right of withdrawal once it does.
            </>
          ) : terms.kind === "installments" ? (
            <>
              I agree to pay {terms.label}, charged automatically, starting today. I want immediate access and
              understand that I lose my 14-day right of withdrawal once it's delivered, so payments are final. If a
              payment fails and isn't fixed within {GRACE_DAYS} days, access pauses until it is.
            </>
          ) : (
            // Must match the confirmation in the receipt (FINAL_SALE_CONFIRMATION in
            // purchase-email.ts): together they make the EU withdrawal waiver valid.
            <>
              I want immediate access to this digital product and understand that I lose my 14-day right of withdrawal
              once it's delivered. All sales are final.
            </>
          )}
        </span>
      </label>

      <div className="relative">
        <div className={acknowledged ? "" : "opacity-50"}>
          <ExpressCheckoutElement
            options={{ buttonHeight: 44, layout: { maxColumns: 1, maxRows: 3, overflow: "never" } }}
            onReady={(e) => setExpressAvailable(!!e.availablePaymentMethods)}
            onClick={(e) => {
              // The actual gate, for every input method (tap, mouse, keyboard):
              // the wallet sheet never opens without the acknowledgement.
              if (!acknowledged) {
                e.reject();
                setAckNudge(true);
                document.getElementById("final-sale-ack")?.focus();
                return;
              }
              e.resolve({ emailRequired: true });
            }}
            onConfirm={handleExpressConfirm}
          />
        </div>
        {/* Friendlier for taps than a silent reject: a transparent layer over
            the dimmed buttons that points the buyer at the box above. */}
        {expressAvailable && !acknowledged ? (
          <button
            type="button"
            className="absolute inset-0 cursor-pointer rounded-md"
            aria-label="Tick the final-sale box above to pay with your wallet"
            onClick={() => {
              setAckNudge(true);
              document.getElementById("final-sale-ack")?.focus();
            }}
          />
        ) : null}
      </div>

      {expressAvailable ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          or pay with card
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      <div>
        <Label htmlFor={`${uid}-f3`}>Email</Label>
        <Input id={`${uid}-f3`}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {/* Wallets live in the express row above, so they're not repeated as tabs here. */}
      <PaymentElement options={{ wallets: { applePay: "never", googlePay: "never" } }} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" disabled={!stripe || submitting || !acknowledged}>
        {submitting
          ? "Processing…"
          : terms.kind === "membership"
            ? `Subscribe — ${money(amountCents)} today`
            : terms.kind === "installments"
              ? `Pay ${money(amountCents)} today`
              : `Pay ${money(amountCents)}`}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Payments are secure and encrypted
      </p>
    </form>
  );
}
