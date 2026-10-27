import type { ComponentType, ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { BarChart3, Wallet, ShoppingBag, Eye, Percent } from "lucide-react";
import { getMyAnalytics } from "@/lib/analytics.functions";
import { getMyFunnel } from "@/lib/funnel.functions";
import { isPeriod, PERIODS, periodLabel, type Period } from "@/lib/analytics-math";
import { formatTotals, totalsWeight } from "@/lib/currency";
import { formatConversionRate } from "@/lib/conversion";
import { RevenueChart } from "@/components/revenue-chart";
import { DonutChart } from "@/components/donut-chart";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  validateSearch: zodValidator(z.object({ period: z.number().optional().catch(undefined) })),
  component: AnalyticsPage,
});

const inPeriod = (p: Period) => (p === 0 ? "all time" : `last ${p} days`);

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

// "▲ 12% vs prev. 30 days". The arrow and the word carry the direction, the
// colour only repeats it. Nothing for all time (there's no period before it),
// and no made-up "+∞%" when the period before had nothing in it.
function Change({ value, unit, period }: { value: number | null; unit: "%" | " pts"; period: Period }) {
  if (period === 0) return null;
  const vs = `vs prev. ${period} days`;
  if (value === null) return <p className="text-xs text-muted-foreground">Nothing to compare yet</p>;
  const shown = unit === "%" ? String(Math.round(Math.abs(value))) : Math.abs(value).toFixed(1);
  if (Number(shown) === 0) return <p className="text-xs text-muted-foreground">No change {vs}</p>;
  const up = value > 0;
  return (
    <p className="text-xs">
      <span className={`font-medium tabular-nums ${up ? "text-trend-up" : "text-trend-down"}`}>
        <span aria-hidden>{up ? "▲" : "▼"} </span>
        <span className="sr-only">{up ? "Up" : "Down"} </span>
        {shown}
        {unit}
      </span>{" "}
      <span className="text-muted-foreground">{vs}</span>
    </p>
  );
}

function Kpi({ icon: Icon, label, value, change }: { icon: ComponentType<{ className?: string }>; label: string; value: string; change: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
        {change}
      </CardContent>
    </Card>
  );
}

// Visits to the seller's page, then each step after it, for the chosen period.
// "—" means that step isn't being counted yet (database update not applied),
// which is different from a real zero.
function FunnelCard({ period }: { period: Period }) {
  const funnelFn = useServerFn(getMyFunnel);
  const funnelQ = useQuery({
    queryKey: ["my-funnel", period],
    queryFn: () => funnelFn({ data: { period } }),
    placeholderData: keepPreviousData,
  });
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
        <CardTitle className="text-base">Your funnel, {inPeriod(period)}</CardTitle>
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
      </CardContent>
    </Card>
  );
}

// 7 / 30 / 90 days / All time, kept in the address so a refresh or a shared
// link opens the same view.
function PeriodSwitch({ period }: { period: Period }) {
  return (
    <div role="group" aria-label="Time period" className="inline-flex rounded-lg border bg-card p-0.5">
      {PERIODS.map((p) => (
        <Link
          key={p}
          to="/dashboard/analytics"
          search={p === 30 ? {} : { period: p }}
          replace
          aria-current={p === period ? "true" : undefined}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {periodLabel(p)}
        </Link>
      ))}
    </div>
  );
}

function AnalyticsPage() {
  const search = Route.useSearch();
  const period: Period = isPeriod(search.period) ? search.period : 30;
  const analyticsFn = useServerFn(getMyAnalytics);
  const analyticsQ = useQuery({
    queryKey: ["my-analytics", period],
    queryFn: () => analyticsFn({ data: { period } }),
    // Switching period keeps the old numbers on screen until the new ones land,
    // rather than flashing the skeleton.
    placeholderData: keepPreviousData,
  });
  const data = analyticsQ.data;
  const k = data?.kpis;

  const topProductMax = Math.max(1, ...(data?.topProducts.map((p) => totalsWeight(p.revenue)) ?? [0]));
  const revenueTitle =
    period === 0 ? "Revenue by month, last 12 months" : period === 90 ? "Revenue by week, last 90 days" : `Revenue, last ${period} days`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          Analytics
        </h1>
        {data?.hasAnyActivity ? <PeriodSwitch period={period} /> : null}
      </div>

      {analyticsQ.isLoading ? (
        // Don't flash $0.00 / "no sales" at a seller who has revenue — show a
        // skeleton until the real numbers arrive.
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-52 animate-pulse rounded-lg bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : analyticsQ.isError || !data || !k ? (
        <p className="text-sm text-muted-foreground">
          We couldn't load your analytics just now. Refresh the page to try again.
        </p>
      ) : !data.hasAnyActivity ? (
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
        <div className={`flex flex-col gap-6 transition-opacity ${analyticsQ.isPlaceholderData ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Wallet} label="Revenue" value={formatTotals(k.revenue.value)} change={<Change value={k.revenue.change} unit="%" period={period} />} />
            <Kpi icon={ShoppingBag} label="Sales" value={k.sales.value.toLocaleString()} change={<Change value={k.sales.change} unit="%" period={period} />} />
            <Kpi icon={Eye} label="Product views" value={k.views.value.toLocaleString()} change={<Change value={k.views.change} unit="%" period={period} />} />
            <Kpi
              icon={Percent}
              label="Conversion"
              value={formatConversionRate(k.sales.value, k.views.value)}
              change={<Change value={k.conversion.pointsChange} unit=" pts" period={period} />}
            />
          </div>

          <FunnelCard period={period} />

          {/* grid-cols-1, not the implicit column: that one grows to fit a long
              product name and pushes the cards off a phone screen. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where visits come from</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={data.donuts.visits}
                  title="Where visits come from"
                  waiting={`Shows once there are ${data.donuts.visits.need} visits in this period. So far: ${data.donuts.visits.have}.`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where buyers come from</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={data.donuts.buyers}
                  title="Where buyers come from"
                  waiting={`Shows once there are ${data.donuts.buyers.need} sales in this period. So far: ${data.donuts.buyers.have}.`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Money by product</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={data.donuts.products}
                  title="Money by product"
                  waiting="Shows once two or more of your products have sold in this period."
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{revenueTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.revenueSeries.length === 0 ? (
                <RevenueChart data={[]} period={period} />
              ) : (
                <div className="flex flex-col gap-6">
                  {data.revenueSeries.map((s) => (
                    <RevenueChart key={s.currency} data={s.days} period={period} currency={s.currency} labelled={data.revenueSeries.length > 1} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top products, {inPeriod(period)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.topProducts.map((p) => (
                <BarRow
                  key={p.id}
                  label={p.name}
                  value={formatTotals(p.revenue)}
                  sublabel={`· ${p.sales} sale${p.sales === 1 ? "" : "s"}${
                    p.views > 0 ? ` · ${formatConversionRate(p.sales, p.views)} conv.` : ""
                  }`}
                  fraction={totalsWeight(p.revenue) / topProductMax}
                />
              ))}
              {data.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">No sales in this period.</p> : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
