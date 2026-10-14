import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Wallet, ShoppingBag, Eye, Percent } from "lucide-react";
import { getMyAnalytics } from "@/lib/analytics.functions";
import { formatCents } from "@/lib/format";
import { formatConversionRate } from "@/lib/conversion";
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
  // Bar length tracks VIEWS, because that's the volume the row is reporting;
  // the sales and conversion figures sit in the label where they can be read
  // exactly rather than estimated from a bar.
  const topSourceMax = Math.max(1, ...(data?.topSources.map((s) => s.views) ?? [0]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        Analytics
      </h1>

      {analyticsQ.isLoading ? (
        // Don't flash $0.00 / "no sales" at a seller who has revenue — show a
        // skeleton until the real numbers arrive.
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-52 animate-pulse rounded-lg bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : analyticsQ.isError ? (
        <p className="text-sm text-muted-foreground">
          We couldn't load your analytics just now. Refresh the page to try again.
        </p>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Revenue
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {formatCents(data?.totalRevenueCents ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" /> Sales
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {data?.totalSales ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Views
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {(data?.totalViews ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Percent className="h-3.5 w-3.5" /> Conversion
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {formatConversionRate(data?.totalSales ?? 0, data?.totalViews ?? 0)}
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
          <CardTitle className="text-base">Where your visitors came from</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(data?.topSources ?? []).map((s) => (
            <BarRow
              key={s.source}
              label={s.source}
              value={`${s.views.toLocaleString()} view${s.views === 1 ? "" : "s"}`}
              sublabel={`· ${s.sales} sale${s.sales === 1 ? "" : "s"}${
                s.views > 0 ? ` · ${formatConversionRate(s.sales, s.views)} conv.` : ""
              }`}
              fraction={s.views / topSourceMax}
            />
          ))}
          {(data?.topSources?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Once someone visits a product page, this shows which link or platform sent
              them — and how many of them bought.
            </p>
          ) : null}
          {(data?.topSources?.length ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Compare the conversion figures, not the view counts: a channel sending a little traffic
              that buys beats one sending a lot that doesn&apos;t. Add{" "}
              <code className="rounded bg-muted px-1">?utm_source=yourname</code> to links you post so
              they don&apos;t all collapse into one row.
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
              sublabel={`· ${p.sales} sale${p.sales === 1 ? "" : "s"}${
                p.views > 0 ? ` · ${formatConversionRate(p.sales, p.views)} conv.` : ""
              }`}
              fraction={p.revenueCents / topProductMax}
            />
          ))}
          {data?.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : null}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
