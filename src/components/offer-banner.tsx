import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Clock, Package } from "lucide-react";
import { formatCountdown } from "@/lib/offer";

// Launch-price countdown and copies-left meter. Everything shown here is
// enforced at checkout — when the timer hits zero the page reloads its data
// and the regular price comes back, because that's what checkout will charge.
export function OfferBanner({
  saleEndsAt,
  stockLimit,
  stockRemaining,
}: {
  saleEndsAt: string | null;
  stockLimit: number | null;
  stockRemaining: number | null;
}) {
  if (!saleEndsAt && stockLimit == null) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      {saleEndsAt ? <SaleCountdown endsAt={saleEndsAt} /> : null}
      {stockLimit != null && stockRemaining != null ? (
        <StockMeter limit={stockLimit} remaining={stockRemaining} />
      ) : null}
    </div>
  );
}

function SaleCountdown({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const end = Date.parse(endsAt);
  // null until mounted, so the server render and first client render match.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(end - Date.now());
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [end]);

  useEffect(() => {
    if (left !== null && left <= 0) void router.invalidate();
  }, [left, router]);

  const endLabel = new Date(end).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
      <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="font-medium">Launch price</span>
      {left === null ? (
        <span className="text-muted-foreground">until {endLabel}</span>
      ) : left > 0 ? (
        <span className="text-muted-foreground">
          ends in{" "}
          <span className="font-medium tabular-nums text-foreground" aria-live="off">
            {formatCountdown(left)}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">has ended — updating the price…</span>
      )}
    </p>
  );
}

function StockMeter({ limit, remaining }: { limit: number; remaining: number }) {
  const claimed = limit - remaining;
  const percent = Math.min(100, Math.round((claimed / limit) * 100));
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm">
        <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        {remaining === 0 ? (
          <span className="font-medium">Sold out — all {limit} copies claimed</span>
        ) : (
          <span>
            <span className="font-medium">
              {remaining} of {limit}
            </span>{" "}
            <span className="text-muted-foreground">copies left</span>
          </span>
        )}
      </p>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Copies claimed"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={claimed}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
