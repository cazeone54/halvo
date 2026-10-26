import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Wallet, ShoppingBag, Eye, Percent } from "lucide-react";
import { getMyAnalytics } from "@/lib/analytics.functions";
import { getMyFunnel } from "@/lib/funnel.functions";
import { formatTotals, totalsWeight } from "@/lib/currency";
import { formatConversionRate } from "@/lib/conversion";
import { RevenueChart } from "@/components/revenue-chart";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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

// Visits to the seller's page, then each step after it, for the last 30 days.
// "—" means that step isn't being counted yet (database update not applied),
// which is different from a real zero.
function FunnelCard() {
  const funnelFn = useServerFn(getMyFunnel);
  const funnelQ = useQuery({ queryKey: ["my-funnel"], queryFn: () => funnelFn() });
  const f = funnelQ.data;
  if (!f) return null;

  const steps: Array<{ label: string; value: number | null; ofVisits?: boolean }> = [
    { label: "Visits to your page", value: f.visits },
    { label: "Taps on your links", value: f.taps },
    { label: "Product page views", value: f.productViews },
    { label: "Free downloads", value: f.freeDownloads, ofVisits: true },
    { label: "Sales", value: f.sales, ofVisits: true },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0));
  const visits = f.visits ?? 0;
  const empty = steps.every((s) => !s.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your funnel, last 30 days</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {empty ? (
          <p className="text-sm text-muted-foreground">
            This fills in as people visit your page. Put your page link in your Instagram or TikTok bio to start.
          </p>
        ) : (
          steps.map((s) => (
            <BarRow
              key={s.label}
              label={s.label}
              value={s.value == null ? "—" : s.value.toLocaleString()}
              fraction={(s.value ?? 0) / max}
              sublabel={s.ofVisits && s.value != null && visits > 0 ? `· ${((s.value / visits) * 100).toFixed(1)}% of visits` : undefined}
            />
          ))
        )}
        {f.topSource ? (
          <p className="text-xs text-muted-foreground">
            Most visits come from <span className="font-medium text-foreground">{f.topSource.name}</span> (
            {Math.round(f.topSource.share * 100)}%).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AnalyticsPage() {
  const analyticsFn = useServerFn(getMyAnalytics);
  const analyticsQ = useQuery({ queryKey: ["my-analytics"], queryFn: () => analyticsFn() });
  const data = analyticsQ.data;

  const topProductMax = Math.max(1, ...(data?.topProducts.map((p) => totalsWeight(p.revenue)) ?? [0]));

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
      ) : data && data.totalViews === 0 && data.totalSales === 0 && data.topProducts.length === 0 ? (
        // Four zeros, a flat chart and "No sales yet." is a deflating first
        // screen, and it's most of what a new seller sees. The dashboard home
        // already hides its own KPIs until there's something in them.
        <EmptyState
          icon={BarChart3}
          title="Nothing to measure yet"
          message="Analytics start the moment someone opens one of your product pages. Publish a product and share the link — views, sales and conversion for each product show up here."
        >
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">Go to your products</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Revenue
            </div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {formatTotals(data?.totalRevenue ?? {})}
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

      <FunnelCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue, last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.dailyRevenue.length ?? 0) === 0 ? (
            <RevenueChart data={[]} />
          ) : (
            <div className="flex flex-col gap-6">
              {data!.dailyRevenue.map((s) => (
                <RevenueChart key={s.currency} data={s.days} currency={s.currency} labelled={data!.dailyRevenue.length > 1} />
              ))}
            </div>
          )}
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
              value={formatTotals(p.revenue)}
              sublabel={`· ${p.sales} sale${p.sales === 1 ? "" : "s"}${
                p.views > 0 ? ` · ${formatConversionRate(p.sales, p.views)} conv.` : ""
              }`}
              fraction={totalsWeight(p.revenue) / topProductMax}
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
