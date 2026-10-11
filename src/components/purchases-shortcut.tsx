import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { listMyPurchases } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";

// Every account lands on the seller dashboard, so someone who signed up to get
// back to things they bought had no visible way to find them (it was only in
// the account menu). Shown only when the account has purchases.
export function PurchasesShortcut() {
  const fn = useServerFn(listMyPurchases);
  const q = useQuery({ queryKey: ["my-purchases"], queryFn: () => fn() });
  const count = q.data?.length ?? 0;
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm">
        <ShoppingBag className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          You have <span className="font-medium">{count}</span> {count === 1 ? "purchase" : "purchases"} on Halvo.
        </span>
      </p>
      <Button asChild size="sm" variant="outline">
        <Link to="/dashboard/purchases">Open your purchases</Link>
      </Button>
    </div>
  );
}
