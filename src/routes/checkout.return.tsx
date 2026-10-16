import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { recordSuccessfulTransaction } from "@/lib/checkout.functions";
import { recordSubscriptionPurchase } from "@/lib/recurring.functions";
import { clearPendingCheckout, readPendingCheckout, safeBackPath } from "@/lib/pending-checkout";
import { PaymentReceivedNotice } from "@/components/checkout-widget";
import { BRAND_NAME } from "@/lib/site";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

// Where Stripe sends a buyer back after approving a payment in another app or
// at their bank (Revolut Pay, iDEAL, Klarna…). Stripe adds payment_intent and
// redirect_status; pid/sub/ack/back are ours (see buildReturnUrl). Everything
// is re-checked against Stripe on the server, so nothing here is trusted.
export const Route = createFileRoute("/checkout/return")({
  validateSearch: zodValidator(
    z.object({
      payment_intent: z.string().startsWith("pi_").optional().catch(undefined),
      redirect_status: z.string().max(40).optional().catch(undefined),
      pid: z.string().uuid().optional().catch(undefined),
      sub: z.string().startsWith("sub_").optional().catch(undefined),
      ack: z.string().max(5).optional().catch(undefined),
      back: z.string().max(500).optional().catch(undefined),
    }),
  ),
  head: () => ({ meta: [{ title: `Finishing your purchase — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: CheckoutReturnPage,
});

type Outcome =
  | { kind: "working" }
  | { kind: "not-paid" }
  | { kind: "received"; email: string | null; processing: boolean };

function CheckoutReturnPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const recordFn = useServerFn(recordSuccessfulTransaction);
  const recordSubFn = useServerFn(recordSubscriptionPurchase);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "working" });
  // Strict mode and fast re-renders must not record the purchase twice.
  const started = useRef(false);
  const back = safeBackPath(search.back);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const { payment_intent: paymentIntentId, pid: productId, sub: subscriptionId, redirect_status: status } = search;
    const saved = readPendingCheckout(productId);
    const email = saved?.email ?? null;

    if (!paymentIntentId || !productId || (status !== "succeeded" && status !== "processing")) {
      // Declined, cancelled in the app, or a link opened by hand.
      clearPendingCheckout();
      setOutcome({ kind: "not-paid" });
      return;
    }
    if (status === "processing") {
      clearPendingCheckout();
      setOutcome({ kind: "received", email, processing: true });
      return;
    }

    const extras = {
      buyerEmail: saved?.email || undefined,
      acknowledgedTerms: saved?.acknowledged ?? search.ack === "1",
      referrer: saved?.referrer,
      utmSource: saved?.utmSource,
    };
    void (async () => {
      // A subscription's first invoice can lag its payment by a moment, so
      // there are a few tries before falling back to "we'll email you".
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { transactionId } = subscriptionId
            ? await recordSubFn({ data: { subscriptionId, productId, ...extras } })
            : await recordFn({
                data: { paymentIntentId, productId, referralCode: saved?.referralCode, ...extras },
              });
          clearPendingCheckout();
          navigate({ to: "/success", search: { id: transactionId }, replace: true });
          return;
        } catch {
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        }
      }
      clearPendingCheckout();
      setOutcome({ kind: "received", email, processing: false });
    })();
  }, [search, navigate, recordFn, recordSubFn]);

  return (
    <div className="mx-auto max-w-lg px-4 pb-10">
      <header className="py-4">
        <Link to="/" aria-label="Halvo home">
          <Logo markClassName="h-6 w-6" />
        </Link>
      </header>
      {outcome.kind === "working" ? (
        <p className="py-6 text-center text-sm text-muted-foreground" role="status">
          Confirming your payment…
        </p>
      ) : outcome.kind === "received" ? (
        <PaymentReceivedNotice email={outcome.email} processing={outcome.processing} />
      ) : (
        <div className="rounded-lg border border-dashed p-5 text-center">
          <p className="text-sm font-medium">The payment wasn't completed.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing was charged. You can try again, or choose another way to pay.
          </p>
          <Button asChild className="mt-4">
            <a href={back}>Back to checkout</a>
          </Button>
        </div>
      )}
    </div>
  );
}
