import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Repeat } from "lucide-react";
import { listMyBuyerSubscriptions } from "@/lib/recurring.functions";
import { GRACE_DAYS } from "@/lib/recurring";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";

const money = (cents: number) => formatCents(cents);
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Seller's view of memberships and payment plans. Hidden until there is at least one.
export function SubscribersCard() {
  const fn = useServerFn(listMyBuyerSubscriptions);
  const q = useQuery({ queryKey: ["my-buyer-subscriptions"], queryFn: () => fn() });
  const subs = q.data?.subscriptions ?? [];
  if (subs.length === 0) return null;

  const live = subs.filter((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due");
  const memberships = live.filter((s) => s.kind === "membership");
  const mrr = memberships.reduce((sum, s) => sum + (s.billing_interval === "year" ? s.amount_cents / 12 : s.amount_cents), 0);
  const atRisk = live.filter((s) => s.past_due_since).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 font-medium">
            <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Memberships & payment plans
          </p>
          <p className="text-sm text-muted-foreground">
            {memberships.length} active member{memberships.length === 1 ? "" : "s"} · {money(Math.round(mrr))}/month
            {atRisk > 0 ? ` · ${atRisk} with a failed payment` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Buyer</th>
                <th className="py-1.5 pr-3 font-medium">Plan</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 font-medium">Next payment</th>
              </tr>
            </thead>
            <tbody>
              {subs.slice(0, 50).map((s) => {
                const failed = !!s.past_due_since;
                const ended = s.status === "canceled" || s.status === "incomplete_expired";
                return (
                  <tr key={s.id} className="border-t">
                    <td className="max-w-[14rem] truncate py-2 pr-3">{s.buyer_email}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {s.kind === "installments"
                        ? `${s.installments_total} × ${money(s.amount_cents)}`
                        : `${money(s.amount_cents)}/${s.billing_interval === "year" ? "yr" : "mo"}`}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          failed
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : ended
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary",
                        )}
                        title={failed ? `Buyer keeps access for ${GRACE_DAYS} days after a failed payment` : undefined}
                      >
                        {failed ? "Payment failed" : ended ? "Ended" : s.cancel_at_period_end ? "Cancelling" : "Active"}
                      </span>
                    </td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {!ended && !s.cancel_at_period_end && s.current_period_end ? date(s.current_period_end) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
