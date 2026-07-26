import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND_KEY, BASE_URL } from "@/lib/site";

const SHARED_KEY = `${BRAND_KEY}:onboarding:shared`;

type Props = {
  // The saved handle (null until claimed) drives both the first step's done
  // state and the share step's copy-link target.
  savedHandle: string | null;
  // The handle input now lives inside this checklist (step 1), so setup reads
  // as one sequence instead of a separate card competing with it.
  handleDraft: string;
  onHandleDraftChange: (value: string) => void;
  onSaveHandle: () => void;
  savingHandle: boolean;
  handleError: string | null;
  hasProduct: boolean;
  stripeConnected: boolean;
  onCreateProduct: () => void;
  onConnectStripe: () => void;
};

export function OnboardingChecklist({
  savedHandle,
  handleDraft,
  onHandleDraftChange,
  onSaveHandle,
  savingHandle,
  handleError,
  hasProduct,
  stripeConnected,
  onCreateProduct,
  onConnectStripe,
}: Props) {
  const [shared, setShared] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(SHARED_KEY) === "1",
  );

  if (savedHandle && hasProduct && stripeConnected && shared) return null;

  const copyLink = async () => {
    if (!savedHandle) return;
    await navigator.clipboard.writeText(`${BASE_URL}/u/${savedHandle}`);
    window.localStorage.setItem(SHARED_KEY, "1");
    setShared(true);
  };

  const steps = [
    {
      key: "handle",
      done: !!savedHandle,
      label: "Claim your storefront handle",
      hint: "Your public store address — it lists everything you sell.",
    },
    {
      key: "product",
      done: hasProduct,
      label: "Create your first product",
      hint: "Upload a file and set a price — this publishes it.",
      action: !hasProduct ? onCreateProduct : undefined,
      actionLabel: "Create product",
    },
    {
      key: "stripe",
      done: stripeConnected,
      label: "Connect Stripe to get paid",
      hint: "~5 minutes. Payouts go to your own account.",
      action: !stripeConnected ? onConnectStripe : undefined,
      actionLabel: "Connect Stripe",
    },
    {
      key: "share",
      done: shared,
      label: "Share your link and make your first sale",
      hint: "Nothing sells until someone sees it.",
      action: !shared && savedHandle ? copyLink : undefined,
      actionLabel: "Copy link",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  // The next incomplete step is the only one that gets an action (or the inline
  // handle input) and a hint — one clear thing to do at a time.
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
            <div key={step.key} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-sm">
                  {step.done ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Circle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${isNext ? "text-primary" : "text-muted-foreground"}`}
                    />
                  )}
                  <div>
                    <span
                      className={
                        step.done ? "text-muted-foreground line-through" : isNext ? "font-medium" : undefined
                      }
                    >
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

              {/* The handle step, when active, edits inline — so the whole setup
                  sequence lives in one place. */}
              {isNext && step.key === "handle" ? (
                <div className="flex flex-col gap-1 pl-6">
                  <div className="flex gap-2">
                    <Input
                      placeholder="yourname"
                      value={handleDraft}
                      // Sanitize to the allowed set as they type, so what they
                      // see is what will save.
                      onChange={(e) => onHandleDraftChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button onClick={onSaveHandle} disabled={!handleDraft || savingHandle} className="shrink-0">
                      {savingHandle ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  {handleError ? (
                    <p className="text-sm text-destructive">{handleError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {handleDraft
                        ? `Your store: ${BASE_URL.replace(/^https?:\/\//, "")}/u/${handleDraft}`
                        : "3–32 characters: lowercase letters, numbers, - or _."}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
