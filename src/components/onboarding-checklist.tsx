import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND_KEY, BASE_URL } from "@/lib/site";

const HIDDEN_KEY = `${BRAND_KEY}:onboarding:hidden`;

/**
 * Whether an account is set up, and so has nothing left to be told about.
 *
 * These four are facts about the account, checked on every visit — so the card
 * disappears by itself and stays gone, on any device. It used to also require
 * clicking "Copy link" inside the card, which is a flag in one browser rather
 * than anything true: a seller who shared their link any other way kept this
 * card at the top of their dashboard forever.
 */
export function isSetUp(s: {
  handle: string | null;
  hasProduct: boolean;
  stripeConnected: boolean;
  hasSupportEmail: boolean;
}): boolean {
  return !!s.handle && s.hasProduct && s.stripeConnected && s.hasSupportEmail;
}

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
  // Buyers are told to contact the seller about a faulty file (the refund
  // policy), so a seller with no support email leaves them nowhere to go.
  hasSupportEmail: boolean;
  // False until the caller's own queries have answered, so the card never
  // shows a state it is about to contradict. Optional, defaulting to shown,
  // so a caller that hasn't been wired up yet still renders correctly.
  ready?: boolean;
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
  hasSupportEmail,
  ready = true,
  onCreateProduct,
  onConnectStripe,
}: Props) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(HIDDEN_KEY) === "1",
  );

  // Nothing at all until the dashboard knows the answers. Rendering before
  // then drew a "0 of 5, nothing done" panel for a fully set-up seller, which
  // then vanished a moment later and moved the page under them.
  if (!ready || hidden) return null;

  if (isSetUp({ handle: savedHandle, hasProduct, stripeConnected, hasSupportEmail })) return null;

  const hide = () => {
    try {
      window.localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      // Storage blocked — it just won't stay hidden next time.
    }
    setHidden(true);
  };

  const copyLink = async () => {
    if (!savedHandle) return;
    await navigator.clipboard.writeText(`${BASE_URL}/u/${savedHandle}`);
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
      key: "support",
      done: hasSupportEmail,
      label: "Add a support email",
      hint: "Shown to buyers, so they can reach you about a problem with a file.",
      action: !hasSupportEmail ? () => navigate({ to: "/dashboard/settings" }) : undefined,
      actionLabel: "Add email",
    },
    {
      key: "share",
      // Never ticked, and deliberately last: it is the thing to do once the
      // four above are true, at which point this whole card is gone.
      done: false,
      label: "Share your link and make your first sale",
      hint: "Nothing sells until someone sees it.",
      action: savedHandle ? copyLink : undefined,
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
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {doneCount} of {steps.length}
            </span>
            {/* Somewhere to put it for anyone who would rather finish setup in
                their own order than be reminded on every visit. */}
            <button
              type="button"
              onClick={hide}
              className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Hide
            </button>
          </div>
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
