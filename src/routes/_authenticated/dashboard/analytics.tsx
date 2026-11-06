import { useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { BarChart3, Wallet, ShoppingBag, Eye, Percent } from "lucide-react";
import { getMyAnalytics } from "@/lib/analytics.functions";
import { getMyFunnel } from "@/lib/funnel.functions";
import { isPeriod, PERIODS, periodLabel, type Period } from "@/lib/analytics-math";
import type { AnalyticsReport, ChartPoint, ProductRow, SourceRow } from "@/lib/analytics-report";
import { CURRENCY_META, formatMoney, formatTotals, totalsWeight, type Currency, type MoneyTotals } from "@/lib/currency";
import { conversionRatePct, formatConversionRate } from "@/lib/conversion";
import { MetricChart, type ChartBar } from "@/components/metric-chart";
import { SortableTable, type Column } from "@/components/sortable-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  validateSearch: zodValidator(
    z.object({
      period: z.number().optional().catch(undefined),
      product: z.string().uuid().optional().catch(undefined),
    }),
  ),
  component: AnalyticsPage,
});

type Metric = "revenue" | "sales" | "views" | "conversion";

const inPeriod = (p: Period) => (p === 0 ? "all time" : `last ${p} days`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// Money in a table cell: one line per currency, so euros and dollars stack
// instead of pushing the table off a phone screen.
function MoneyCell({ totals }: { totals: MoneyTotals }) {
  const parts = (Object.keys(CURRENCY_META) as Currency[]).filter((c) => (totals[c] ?? 0) > 0);
  if (parts.length === 0) return <>—</>;
  return (
    <>
      {parts.map((c) => (
        <span key={c} className="block">
          {formatMoney(totals[c]!, c)}
        </span>
      ))}
    </>
  );
}

// A labelled horizontal bar: identity on the left, a magnitude bar filling to
// the row's share of the max, value on the right. Bar is the only colour; text
// stays in ink tokens.
function BarRow({ label, value, fraction, sublabel }: { label: string; value: string; fraction: number; sublabel?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
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

// A headline number that is also the switch for the chart under it: the
// chosen one carries a teal edge, the way a tab does.
function Kpi({
  icon: Icon,
  label,
  value,
  change,
  selected,
  onSelect,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-controls="analytics-chart"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-card p-4 text-left text-card-foreground shadow transition-colors sm:p-5",
        "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight sm:text-2xl">{value}</span>
      {change}
    </button>
  );
}

// The chosen measure over time. Money is drawn per currency (euros and dollars
// can't honestly share an axis), so a seller paid in both gets one chart each.
function MainChart({ report, metric }: { report: AnalyticsReport; metric: Metric }) {
  const points = report.chart;
  const unit = points[0]?.unit ?? "day";
  const by = unit === "month" ? "by month, last 12 months" : unit === "week" ? "by week, last 90 days" : `by day, ${inPeriod(report.period)}`;
  const names: Record<Metric, string> = { revenue: "Revenue", sales: "Sales", views: "Product views", conversion: "Conversion" };

  // Each bar's readout lists the other measures for the same day.
  const detail = (p: ChartPoint) =>
    [
      metric !== "revenue" && totalsWeight(p.revenue) > 0 ? formatTotals(p.revenue) : null,
      metric !== "sales" ? plural(p.sales, "sale") : null,
      metric !== "views" ? plural(p.views, "view") : null,
      metric !== "conversion" && p.views > 0 ? `${formatConversionRate(p.sales, p.views)} conversion` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const bars = (value: (p: ChartPoint) => number | null): ChartBar[] =>
    points.map((p) => ({ key: p.key, start: p.start, unit: p.unit, value: value(p), detail: detail(p) }));

  let body: ReactNode;
  if (metric === "revenue") {
    const currencies = (Object.keys(CURRENCY_META) as Currency[]).filter((c) => points.some((p) => (p.revenue[c] ?? 0) > 0));
    body =
      currencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sales in this period.</p>
      ) : (
        <div className={cn("grid grid-cols-1 gap-6", currencies.length > 1 && "lg:grid-cols-2")}>
          {currencies.map((c) => (
            <MetricChart
              key={c}
              bars={bars((p) => p.revenue[c] ?? 0)}
              format={(cents) => formatMoney(cents, c)}
              axisFormat={(cents) => (cents % 100 === 0 ? `${CURRENCY_META[c].symbol}${(cents / 100).toLocaleString("en-US")}` : formatMoney(cents, c))}
              label={`Revenue in ${CURRENCY_META[c].name}`}
              caption={currencies.length > 1 ? `In ${CURRENCY_META[c].name}` : undefined}
              empty="No sales in this period."
            />
          ))}
        </div>
      );
  } else if (metric === "conversion") {
    body = (
      <MetricChart
        bars={bars((p) => conversionRatePct(p.sales, p.views))}
        format={(pct) => `${pct.toFixed(pct < 10 ? 1 : 0)}%`}
        axisFormat={(pct) => `${Math.round(pct * 10) / 10}%`}
        label="Conversion"
        empty="No sales in this period, so nothing has converted yet."
      />
    );
  } else {
    const noun = metric === "sales" ? "sale" : "view";
    body = (
      <MetricChart
        bars={bars((p) => (metric === "sales" ? p.sales : p.views))}
        format={(n) => plural(n, noun)}
        axisFormat={(n) => n.toLocaleString("en-US")}
        whole
        label={names[metric]}
        empty={metric === "sales" ? "No sales in this period." : "No product page views in this period."}
      />
    );
  }

  return (
    <Card id="analytics-chart">
      <CardHeader>
        <CardTitle className="text-base">
          {names[metric]} {by}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
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

function SourcesCard({ rows }: { rows: SourceRow[] }) {
  const most = Math.max(1, ...rows.map((r) => r.views));
  const columns: Column<SourceRow>[] = [
    { key: "source", label: "Source", sortValue: (r) => r.source, cell: (r) => r.source },
    { key: "views", label: "Views", numeric: true, sortValue: (r) => r.views, cell: (r) => r.views.toLocaleString("en-US") },
    { key: "sales", label: "Sales", numeric: true, sortValue: (r) => r.sales, cell: (r) => r.sales.toLocaleString("en-US") },
    {
      key: "conversion",
      label: "Conv.",
      numeric: true,
      sortValue: (r) => conversionRatePct(r.sales, r.views) ?? -1,
      cell: (r) => formatConversionRate(r.sales, r.views),
    },
    {
      key: "revenue",
      label: "Revenue",
      numeric: true,
      width: "w-[24%] sm:w-[18%]",
      sortValue: (r) => totalsWeight(r.revenue),
      cell: (r) => <MoneyCell totals={r.revenue} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where people come from</CardTitle>
        <p className="text-sm text-muted-foreground">Views of your product pages, and the sales that followed.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has opened one of your product pages in this period.</p>
        ) : (
          <SortableTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.source}
            defaultSort={{ key: "views", dir: "desc" }}
            caption="Where people come from"
            limit={8}
            bar={(r) => r.views / most}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ProductsCard({ rows, onPick }: { rows: ProductRow[]; onPick: (id: string) => void }) {
  const anyFree = rows.some((r) => r.free > 0);
  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      label: "Product",
      sortValue: (r) => r.name,
      cell: (r) =>
        r.removed ? (
          <span className="text-muted-foreground">{r.name}</span>
        ) : (
          <button
            type="button"
            onClick={() => onPick(r.id)}
            title="Show only this product"
            className="max-w-full truncate rounded-sm text-left hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {r.name}
          </button>
        ),
    },
    { key: "views", label: "Views", numeric: true, sortValue: (r) => r.views, cell: (r) => r.views.toLocaleString("en-US") },
    { key: "sales", label: "Sales", numeric: true, sortValue: (r) => r.sales, cell: (r) => r.sales.toLocaleString("en-US") },
    ...(anyFree
      ? [
          {
            key: "free",
            label: "Free",
            numeric: true,
            sortValue: (r: ProductRow) => r.free,
            cell: (r: ProductRow) => r.free.toLocaleString("en-US"),
            className: "hidden sm:table-cell",
          },
        ]
      : []),
    {
      key: "conversion",
      label: "Conv.",
      numeric: true,
      sortValue: (r) => conversionRatePct(r.sales, r.views) ?? -1,
      cell: (r) => formatConversionRate(r.sales, r.views),
    },
    {
      key: "revenue",
      label: "Revenue",
      numeric: true,
      width: "w-[24%] sm:w-[18%]",
      sortValue: (r) => totalsWeight(r.revenue),
      cell: (r) => <MoneyCell totals={r.revenue} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Products</CardTitle>
        <p className="text-sm text-muted-foreground">Tap a product to see the whole page for it alone.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No views or sales in this period.</p>
        ) : (
          <SortableTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            defaultSort={{ key: "revenue", dir: "desc" }}
            caption="Products"
            limit={10}
          />
        )}
      </CardContent>
    </Card>
  );
}

function LinksCard({ links, period }: { links: NonNullable<AnalyticsReport["links"]>; period: Period }) {
  const most = Math.max(1, ...links.map((l) => l.taps));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taps on your links, {inPeriod(period)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {links.map((l) => (
          <BarRow key={l.id} label={l.title} value={plural(l.taps, "tap")} fraction={l.taps / most} />
        ))}
      </CardContent>
    </Card>
  );
}

function MembershipsCard({ m, period }: { m: NonNullable<AnalyticsReport["memberships"]>; period: Period }) {
  const stats = [
    { label: "Active members", value: m.active.toLocaleString("en-US") },
    { label: "Monthly income", value: formatTotals(m.monthly) },
    { label: `Joined, ${inPeriod(period)}`, value: m.joined.toLocaleString("en-US") },
    { label: `Left, ${inPeriod(period)}`, value: m.left.toLocaleString("en-US") },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Memberships</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
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
          search={(prev) => ({ ...prev, period: p === 30 ? undefined : p })}
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
  const navigate = useNavigate({ from: Route.fullPath });
  const period: Period = isPeriod(search.period) ? search.period : 30;
  const product = search.product ?? null;
  const [metric, setMetric] = useState<Metric>("revenue");
  const analyticsFn = useServerFn(getMyAnalytics);
  const analyticsQ = useQuery({
    queryKey: ["my-analytics", period, product],
    queryFn: () => analyticsFn({ data: { period, product: product ?? undefined } }),
    // Switching period or product keeps the old numbers on screen until the
    // new ones land, rather than flashing the skeleton.
    placeholderData: keepPreviousData,
  });
  const data = analyticsQ.data;
  const k = data?.kpis;
  const pickProduct = (id: string | null) => {
    navigate({ search: (prev) => ({ ...prev, product: id ?? undefined }), replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Analytics</h1>
        {/* One row of filters above everything they apply to. */}
        {data?.hasAnyActivity ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="analytics-product" className="sr-only">
              Product
            </label>
            <select
              id="analytics-product"
              value={data.productId ?? ""}
              onChange={(e) => pickProduct(e.target.value || null)}
              className="h-9 max-w-full min-w-0 rounded-lg border bg-card px-2.5 text-sm text-foreground sm:max-w-xs"
            >
              <option value="">All products</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <PeriodSwitch period={period} />
          </div>
        ) : null}
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
          <div className="h-60 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
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
            <Link to="/dashboard/products">Go to your products</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className={`flex flex-col gap-6 transition-opacity ${analyticsQ.isPlaceholderData ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              icon={Wallet}
              label="Revenue"
              value={formatTotals(k.revenue.value)}
              change={<Change value={k.revenue.change} unit="%" period={period} />}
              selected={metric === "revenue"}
              onSelect={() => setMetric("revenue")}
            />
            <Kpi
              icon={ShoppingBag}
              label="Sales"
              value={k.sales.value.toLocaleString("en-US")}
              change={<Change value={k.sales.change} unit="%" period={period} />}
              selected={metric === "sales"}
              onSelect={() => setMetric("sales")}
            />
            <Kpi
              icon={Eye}
              label="Product views"
              value={k.views.value.toLocaleString("en-US")}
              change={<Change value={k.views.change} unit="%" period={period} />}
              selected={metric === "views"}
              onSelect={() => setMetric("views")}
            />
            <Kpi
              icon={Percent}
              label="Conversion"
              value={formatConversionRate(k.sales.value, k.views.value)}
              change={<Change value={k.conversion.pointsChange} unit=" pts" period={period} />}
              selected={metric === "conversion"}
              onSelect={() => setMetric("conversion")}
            />
          </div>

          <MainChart report={data} metric={metric} />

          <SourcesCard rows={data.sources} />

          {data.productId ? null : <ProductsCard rows={data.productRows} onPick={pickProduct} />}

          {data.memberships ? <MembershipsCard m={data.memberships} period={period} /> : null}

          {/* The funnel and the links are about the shop page, not any one product. */}
          {data.productId ? null : (
            <div className={cn("grid grid-cols-1 gap-6", data.links && "lg:grid-cols-2")}>
              <FunnelCard period={period} />
              {data.links ? <LinksCard links={data.links} period={period} /> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
