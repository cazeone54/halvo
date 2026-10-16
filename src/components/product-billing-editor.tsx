import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { setProductBilling } from "@/lib/recurring.functions";
import { GRACE_DAYS, installmentAmountCents, validateBilling, type BillingInterval } from "@/lib/recurring";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { CURRENCY_SYMBOL } from "@/lib/site";

type Model = "one_time" | "plan" | "membership";
const money = (cents: number) => formatCents(cents);

export function ProductBillingEditor({
  productId,
  priceCents,
  payWhatYouWant,
  billingType,
  billingInterval,
  installmentCount,
}: {
  productId: string;
  priceCents: number;
  payWhatYouWant: boolean;
  billingType: string | null | undefined;
  billingInterval: string | null | undefined;
  installmentCount: number | null | undefined;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setProductBilling);
  const [model, setModel] = useState<Model>(
    billingType === "membership" ? "membership" : installmentCount ? "plan" : "one_time",
  );
  const [interval, setBillingInterval] = useState<BillingInterval>(billingInterval === "year" ? "year" : "month");
  const [count, setCount] = useState(installmentCount ?? 3);

  const input = {
    billingType: model === "membership" ? ("membership" as const) : ("one_time" as const),
    billingInterval: model === "membership" ? interval : null,
    installmentCount: model === "plan" ? count : null,
  };
  const problem = validateBilling({ ...input, priceCents, payWhatYouWant });

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { productId, ...input } }),
    onSuccess: () => {
      toast.success("Pricing model saved.");
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options: Array<{ value: Model; title: string; detail: string }> = [
    { value: "one_time", title: "One payment", detail: `Buyers pay ${money(priceCents)} once.` },
    {
      value: "plan",
      // Named for the thing itself, not for how it differs from the option
      // above it: titles that both began "One payment" were indistinguishable
      // when scanning the row.
      title: "Payment plan",
      detail: `Buyers choose to pay in full, or spread it over monthly payments — useful above about ${CURRENCY_SYMBOL}100.`,
    },
    {
      value: "membership",
      title: "Membership",
      detail: "Buyers pay every month or year and keep access while subscribed.",
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <div>
        <p className="text-sm font-medium">Pricing model</p>
        <p className="text-xs text-muted-foreground">
          Recurring payments retry automatically. If one fails, buyers keep access for {GRACE_DAYS} days while they
          update their card.
        </p>
      </div>

      <div role="radiogroup" aria-label="Pricing model" className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={model === o.value}
            onClick={() => setModel(o.value)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              model === o.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
            )}
          >
            <span className="block text-sm font-medium">{o.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{o.detail}</span>
          </button>
        ))}
      </div>

      {model === "plan" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`installments-${productId}`}>Split into</label>
          <select
            id={`installments-${productId}`}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">
            monthly payments of {money(installmentAmountCents(priceCents, count))}
          </span>
        </div>
      ) : null}

      {model === "membership" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Bill buyers {money(priceCents)} every</span>
          {(["month", "year"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`interval-${productId}`}
                checked={interval === v}
                onChange={() => setBillingInterval(v)}
                className="h-4 w-4 accent-primary"
              />
              {v}
            </label>
          ))}
        </div>
      ) : null}

      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
      {model === "membership" ? (
        <p className="text-xs text-muted-foreground">
          Coupons, order bumps and pay-what-you-want don't apply to memberships. Existing members keep the price they
          signed up at.
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={!!problem || saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        {saveMut.isPending ? "Saving…" : "Save pricing model"}
      </Button>
    </div>
  );
}
