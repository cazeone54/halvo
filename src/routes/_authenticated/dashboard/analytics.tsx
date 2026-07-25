import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Wallet, ShoppingBag } from "lucide-react";
import { getMyAnalytics } from "@/lib/analytics.functions";
import { formatCents } from "@/lib/format";
import { RevenueChart } from "@/components/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  component: AnalyticsPage,
});

// A labelled horizontal bar: identity on the left, a magnitude bar filling to
// the row's share of the max, value on the right. Bar is the only colour; text
// stays in ink tokens.
function BarRow({ label, value, fraction, sublabel }: { label: string; value: string; fraction: number; sublabel?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate capitalize">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
          {value}
          {sublabel ? <span className="ml-1">{sublabel}</span> : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%` }}
        />
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const analyticsFn = useServerFn(getMyAnalytics);
  const analyticsQ = useQuery({ queryKey: ["my-analytics"], queryFn: () => analyticsFn() });
  const data = analyticsQ.data;

  const topProductMax = Math.max(1, ...(data?.topProducts.map((p) => p.revenueCents) ?? [0]));
  const topSourceMax = Math.max(1, ...(data?.topSources.map((s) => s.sales) ?? [0]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        Analytics
      </h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Total revenue
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {formatCents(data?.totalRevenueCents ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" /> Total sales
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {data?.totalSales ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue, last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={data?.dailyRevenue ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where your sales came from</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(data?.topSources ?? []).map((s) => (
            <BarRow
              key={s.source}
              label={s.source}
              value={`${s.sales} sale${s.sales === 1 ? "" : "s"}`}
              fraction={s.sales / topSourceMax}
            />
          ))}
          {(data?.topSources?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Once you make a sale, this shows which link or platform sent the buyer.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top products</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(data?.topProducts ?? []).map((p) => (
            <BarRow
              key={p.name}
              label={p.name}
              value={formatCents(p.revenueCents)}
              sublabel={`· ${p.sales} sale${p.sales === 1 ? "" : "s"}`}
              fraction={p.revenueCents / topProductMax}
            />
          ))}
          {data?.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
