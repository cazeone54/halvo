import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { AlertTriangle, CalendarClock, CircleCheck, CreditCard, Download } from "lucide-react";
import { describeBilling, openBillingPortal } from "@/lib/recurring.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND_NAME } from "@/lib/site";

// A buyer's membership / payment plan, reached from the signed link in their
// email (buyers don't have accounts). Card changes, receipts and cancelling
// happen in Stripe's billing portal.
export const Route = createFileRoute("/billing")({
  validateSearch: zodValidator(z.object({ t: z.string().max(200).optional().catch(undefined) })),
  head: () => ({ meta: [{ title: `Your billing — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: BillingPage,
});

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function BillingPage() {
  const { t } = Route.useSearch();
  const describeFn = useServerFn(describeBilling);
  const portalFn = useServerFn(openBillingPortal);
  const q = useQuery({
    queryKey: ["billing", t],
    queryFn: () => describeFn({ data: { token: t! } }),
    enabled: !!t && t.length >= 10,
  });
  const portal = useMutation({
    mutationFn: () => portalFn({ data: { token: t! } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  if (!t || (q.isSuccess && !q.data)) {
    return (
      <Notice title="This billing link isn't valid" body="Use the most recent billing link from your email." />
    );
  }
  if (q.isLoading) {
    return <p className="mx-auto max-w-lg px-4 py-12 text-sm text-muted-foreground">Loading your billing…</p>;
  }
  if (q.isError || !q.data) {
    return <Notice title="We couldn't load your billing" body="Please try again in a moment." />;
  }

  const b = q.data;
  const access = b.access;
  const isPlan = b.kind === "installments";

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="text-sm text-muted-foreground">{isPlan ? "Payment plan" : "Membership"}</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
        {b.productName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{b.planLabel}</p>

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 p-5">
          {access?.state === "grace" ? (
            <Status
              tone="warn"
              icon={AlertTriangle}
              title="Your last payment didn't go through"
              body={`You have full access until ${fmtDate(access.graceEndsAt)}. Update your card to keep it — we'll retry automatically.`}
            />
          ) : access?.state === "suspended" ? (
            <Status
              tone="warn"
              icon={AlertTriangle}
              title="Access is paused"
              body="A payment didn't go through. Update your card and access comes back as soon as it's paid."
            />
          ) : access?.state === "ended" ? (
            <Status tone="muted" icon={CalendarClock} title="This has ended" body="No further payments will be taken." />
          ) : access?.state === "owned" ? (
            <Status tone="ok" icon={CircleCheck} title="Paid in full" body="Every payment is done — it's yours to keep." />
          ) : access?.state === "ending" ? (
            <Status
              tone="muted"
              icon={CalendarClock}
              title="Cancelled"
              body={`You keep access until ${fmtDate(access.endsAt)}. You won't be charged again.`}
            />
          ) : (
            <Status
              tone="ok"
              icon={CircleCheck}
              title="Active"
              body={
                b.cancelAtPeriodEnd && b.currentPeriodEnd
                  ? `Cancels on ${fmtDate(b.currentPeriodEnd)} — you won't be charged again.`
                  : b.currentPeriodEnd
                    ? `Next payment on ${fmtDate(b.currentPeriodEnd)}.`
                    : "Your payments are up to date."
              }
            />
          )}

          {isPlan && b.installmentsTotal ? (
            <div>
              <div className="flex justify-between text-sm">
                <span>Payments made</span>
                <span className="tabular-nums">
                  {Math.min(b.paidCount, b.installmentsTotal)} of {b.installmentsTotal}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Payments made"
                aria-valuemin={0}
                aria-valuemax={b.installmentsTotal}
                aria-valuenow={Math.min(b.paidCount, b.installmentsTotal)}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (b.paidCount / b.installmentsTotal) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {access?.state !== "ended" && access?.state !== "owned" ? (
              <Button onClick={() => portal.mutate()} disabled={portal.isPending}>
                <CreditCard className="h-4 w-4" />
                {portal.isPending ? "Opening…" : isPlan ? "Update card & receipts" : "Manage membership"}
              </Button>
            ) : null}
            {b.downloadTransactionId && access?.access ? (
              <Button asChild variant="outline">
                <Link to="/success" search={{ id: b.downloadTransactionId }}>
                  <Download className="h-4 w-4" /> Your downloads
                </Link>
              </Button>
            ) : null}
          </div>
          {portal.error ? <p className="text-sm text-destructive">{(portal.error as Error).message}</p> : null}
          {!isPlan ? (
            <p className="text-xs text-muted-foreground">
              You can update your card, download receipts or cancel in the secure billing portal, run by Stripe.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Status({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "ok" | "warn" | "muted";
  icon: typeof CircleCheck;
  title: string;
  body: string;
}) {
  const color = tone === "ok" ? "text-primary" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <div className="flex items-start gap-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-medium">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
