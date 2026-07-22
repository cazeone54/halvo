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
    { done: hasProduct, label: "Create your first product", action: !hasProduct ? onCreateProduct : undefined, actionLabel: "Create product" },
    { done: stripeConnected, label: "Connect Stripe to get paid", action: !stripeConnected ? onConnectStripe : undefined, actionLabel: "Connect Stripe" },
    { done: shared, label: "Share your storefront link", action: !shared && handle ? copyLink : undefined, actionLabel: "Copy link" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Get set up</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {step.done ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={step.done ? "text-muted-foreground line-through" : undefined}>{step.label}</span>
            </div>
            {step.action ? (
              <Button size="sm" variant="outline" onClick={step.action}>
                {step.actionLabel}
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
