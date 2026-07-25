import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BRAND_KEY, BASE_URL } from "@/lib/site";

const SHARED_KEY = `${BRAND_KEY}:onboarding:shared`;

type Props = {
  hasProduct: boolean;
  stripeConnected: boolean;
  handle: string | null;
  onCreateProduct: () => void;
  onConnectStripe: () => void;
};

export function OnboardingChecklist({ hasProduct, stripeConnected, handle, onCreateProduct, onConnectStripe }: Props) {
  const [shared, setShared] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(SHARED_KEY) === "1",
  );

  if (hasProduct && stripeConnected && shared) return null;

  const copyLink = async () => {
    if (!handle) return;
    await navigator.clipboard.writeText(`${BASE_URL}/u/${handle}`);
    window.localStorage.setItem(SHARED_KEY, "1");
    setShared(true);
  };

  const steps = [
    {
      done: hasProduct,
      label: "Create your first product",
      hint: "Upload a file and set a price — this publishes it.",
      action: !hasProduct ? onCreateProduct : undefined,
      actionLabel: "Create product",
    },
    {
      done: stripeConnected,
      label: "Connect Stripe to get paid",
      hint: "~5 minutes. Payouts go to your own account.",
      action: !stripeConnected ? onConnectStripe : undefined,
      actionLabel: "Connect Stripe",
    },
    {
      done: shared,
      label: "Share your link and make your first sale",
      hint: "Nothing sells until someone sees it.",
      action: !shared && handle ? copyLink : undefined,
      actionLabel: "Copy link",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  // The next incomplete step is the only one that gets an action button and a
  // hint — one clear thing to do, rather than three competing calls to action.
  const nextIndex = steps.findIndex((s) => !s.done);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Get set up</CardTitle>
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {doneCount} of {steps.length}
          </span>
        </div>
        {/* An unfinished progress bar is a strong nudge to finish it. */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const isNext = i === nextIndex;
          return (
            <div key={step.label} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 text-sm">
                {step.done ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${isNext ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <div>
                  <span className={step.done ? "text-muted-foreground line-through" : isNext ? "font-medium" : undefined}>
                    {step.label}
                  </span>
                  {isNext ? <p className="text-xs text-muted-foreground">{step.hint}</p> : null}
                </div>
              </div>
              {step.action && isNext ? (
                <Button size="sm" onClick={step.action} className="shrink-0">
                  {step.actionLabel}
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
