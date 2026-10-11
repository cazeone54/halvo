import { CURRENCY_CODE } from "@/lib/site";
import { formatCents } from "@/lib/format";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { setProductOffer } from "@/lib/offer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// <input type="datetime-local"> speaks local wall-clock time without a zone.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DURATIONS = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export function ProductOfferEditor({
  productId,
  priceCents,
  payWhatYouWant,
  stockLimit,
  salePriceCents,
  saleEndsAt,
}: {
  productId: string;
  priceCents: number;
  payWhatYouWant: boolean;
  stockLimit: number | null;
  salePriceCents: number | null;
  saleEndsAt: string | null;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setProductOffer);
  const canSale = !payWhatYouWant && priceCents > 0;

  const [limitOn, setLimitOn] = useState(stockLimit != null);
  const [limit, setLimit] = useState(stockLimit != null ? String(stockLimit) : "50");
  const [saleOn, setSaleOn] = useState(salePriceCents != null);
  const [salePrice, setSalePrice] = useState(
    salePriceCents != null ? (salePriceCents / 100).toFixed(2) : ((priceCents * 0.7) / 100).toFixed(2),
  );
  const [ends, setEnds] = useState(toLocalInput(saleEndsAt));

  const saleEnded = saleEndsAt != null && Date.parse(saleEndsAt) <= Date.now();

  const saveMut = useMutation({
    mutationFn: () => {
      const endsIso = saleOn && ends ? new Date(ends).toISOString() : null;
      return saveFn({
        data: {
          productId,
          stockLimit: limitOn ? Math.round(Number(limit)) : null,
          salePriceCents: saleOn ? Math.round(Number(salePrice) * 100) : null,
          saleEndsAt: saleOn ? endsIso : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Offer saved.");
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed p-3">
      <div>
        <p className="text-sm font-medium">Launch offer</p>
        <p className="text-xs text-muted-foreground">
          Real urgency only — both are enforced at checkout, and the page shows buyers exactly what's true.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={saleOn}
            disabled={!canSale}
            onChange={(e) => setSaleOn(e.target.checked)}
          />
          Launch price that ends automatically
        </label>
        {!canSale ? (
          <p className="pl-6 text-xs text-muted-foreground">Available for fixed-price paid products.</p>
        ) : saleOn ? (
          <div className="flex flex-col gap-2 pl-6">
            <div className="flex flex-wrap gap-3">
              <div className="w-32">
                <Label htmlFor={`sale-price-${productId}`}>Launch price ({CURRENCY_CODE})</Label>
                <Input
                  id={`sale-price-${productId}`}
                  type="number"
                  min="0.5"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor={`sale-ends-${productId}`}>Ends</Label>
                <Input
                  id={`sale-ends-${productId}`}
                  type="datetime-local"
                  value={ends}
                  onChange={(e) => setEnds(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Run for
              {DURATIONS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  className="rounded-full border px-2 py-0.5 hover:border-primary hover:text-primary"
                  onClick={() => setEnds(toLocalInput(new Date(Date.now() + d.hours * 3_600_000).toISOString()))}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Regular price {formatCents(priceCents)} is shown crossed out, with a countdown. When it ends, checkout
              charges the regular price again.
              {saleEnded ? " Your last launch price has ended." : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={limitOn}
            onChange={(e) => setLimitOn(e.target.checked)}
          />
          Limited number of copies
        </label>
        {limitOn ? (
          <div className="flex items-end gap-3 pl-6">
            <div className="w-32">
              <Label htmlFor={`stock-${productId}`}>Copies</Label>
              <Input
                id={`stock-${productId}`}
                type="number"
                min="1"
                step="1"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">Counts every completed sale. Sells out at zero.</p>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending || (saleOn && !ends)}
      >
        {saveMut.isPending ? "Saving…" : "Save offer"}
      </Button>
    </div>
  );
}
