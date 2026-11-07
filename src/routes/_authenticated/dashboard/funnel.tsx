import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Filter } from "lucide-react";
import { getSignupFunnel } from "@/lib/admin-funnel.functions";
import { isPeriod, PERIODS, periodLabel, type Period } from "@/lib/analytics-math";
import { BRAND_NAME } from "@/lib/site";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The owner's page: how far new sellers get, step by step, and where they
// stop. Not linked from the menu; open it at /dashboard/funnel.
export const Route = createFileRoute("/_authenticated/dashboard/funnel")({
  validateSearch: zodValidator(z.object({ period: z.number().optional().catch(undefined) })),
  head: () => ({ meta: [{ title: `Seller funnel — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: FunnelPage,
});

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function FunnelPage() {
  const search = Route.useSearch();
  const period: Period = isPeriod(search.period) ? search.period : 30;
  const fn = useServerFn(getSignupFunnel);
  const q = useQuery({
    queryKey: ["signup-funnel", period],
    queryFn: () => fn({ data: { period } }),
    placeholderData: keepPreviousData,
  });
  const d = q.data;

  if (q.isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  if (q.isError) return <p className="text-sm text-muted-foreground">Couldn't load the funnel just now. Refresh to try again.</p>;
  if (!d || !d.allowed) return <p className="text-sm text-muted-foreground">This page is only for the site owner.</p>;

  const max = Math.max(1, d.steps[0]?.count ?? 0);
  const dayMax = Math.max(1, ...d.perDay.map((x) => x.count));

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${q.isPlaceholderData ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
          <Filter className="h-5 w-5 text-muted-foreground" />
          Seller funnel
        </h1>
        <div role="group" aria-label="Time period" className="inline-flex rounded-lg border bg-card p-0.5">
          {PERIODS.map((p) => (
            <Link
              key={p}
              to="/dashboard/funnel"
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            New accounts, {period === 0 ? "all time" : `last ${period} days`} — how far they got
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {d.steps.map((s, i) => {
            const prev = i > 0 ? d.steps[i - 1].count : null;
            const lost = prev !== null && prev > s.count ? prev - s.count : 0;
            return (
              <div key={s.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">{s.label}</span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    <span className="font-medium">{s.count}</span>
                    <span className="ml-1.5 text-muted-foreground">{pct(s.ofSignups)}</span>
                    {lost > 0 ? <span className="ml-1.5 text-xs text-trend-down">−{lost}</span> : null}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(s.count ? 2 : 0, (s.count / max) * 100)}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            % is of everyone who signed up in the period; −N is how many stopped since the step before. Your own
            account isn't counted.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where sign-ups came from</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {d.sources.length === 0 ? <p className="text-muted-foreground">No sign-ups in this period.</p> : null}
            {d.sources.map((s) => (
              <div key={s.source} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{s.source}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign-ups per day, last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-28 items-end gap-[3px]">
              {d.perDay.map((x) => (
                <div key={x.day} className="group relative flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[3px] bg-primary"
                    style={{ height: `${x.count ? Math.max(4, (x.count / dayMax) * 100) : 0}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                    <span className="font-medium">{x.count}</span>
                    <span className="ml-1 text-muted-foreground">
                      {new Date(`${x.day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>
                {new Date(`${d.perDay[0]?.day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
              </span>
              <span>Today</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">A sudden tall bar usually means a batch of fake sign-ups.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
