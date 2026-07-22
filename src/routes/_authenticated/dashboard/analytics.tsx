import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { getMyAnalytics } from "@/lib/analytics.functions";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const analyticsFn = useServerFn(getMyAnalytics);
  const analyticsQ = useQuery({ queryKey: ["my-analytics"], queryFn: () => analyticsFn() });
  const data = analyticsQ.data;

  const maxDaily = Math.max(1, ...(data?.dailyRevenue.map((d) => d.revenueCents) ?? [0]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        Analytics
      </h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total revenue</p>
            <p className="text-xl font-semibold">{formatCents(data?.totalRevenueCents ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total sales</p>
            <p className="text-xl font-semibold">{data?.totalSales ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue, last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.dailyRevenue.length > 0 ? (
            <div className="flex h-32 items-end gap-1">
              {data.dailyRevenue.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${formatCents(d.revenueCents)}`}
                  className="flex-1 rounded-t bg-primary"
                  style={{ height: `${Math.max(4, (d.revenueCents / maxDaily) * 100)}%` }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sales in the last 30 days.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top products</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data?.topProducts ?? []).map((p) => (
            <div key={p.name} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <span>
                {formatCents(p.revenueCents)} · {p.sales} sale{p.sales === 1 ? "" : "s"}
              </span>
            </div>
          ))}
          {data?.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
