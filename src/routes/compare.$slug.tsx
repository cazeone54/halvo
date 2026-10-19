import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowRight, Check, CircleDot } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { FeeComparison } from "@/components/fee-comparison";
import { Button } from "@/components/ui/button";
import { findComparison, type Point } from "@/content/comparisons";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/compare/$slug")({
  loader: ({ params }) => {
    const comparison = findComparison(params.slug);
    if (!comparison) throw notFound();
    return comparison;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const title = `${BRAND_NAME} vs ${loaderData.competitor}: an honest comparison`;
    const url = `${BASE_URL}/compare/${loaderData.slug}`;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: loaderData.metaDescription },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: loaderData.metaDescription },
      ],
    };
  },
  component: ComparisonPage,
});

function PointList({ points, icon }: { points: Point[]; icon: "check" | "dot" }) {
  const Icon = icon === "check" ? Check : CircleDot;
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {points.map((p) => (
        <li key={p.title} className="flex gap-3">
          <Icon
            className={icon === "check" ? "mt-0.5 h-4 w-4 shrink-0 text-primary" : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"}
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">{p.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ComparisonPage() {
  const c = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="border-b bg-hero-glow">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-20">
            <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Honest comparison
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-5xl">
              {BRAND_NAME} vs {c.competitor}
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">{c.intro}</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Where {BRAND_NAME} is better</h2>
              <PointList points={c.halvoBetter} icon="check" />
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Where {c.competitor} is better
              </h2>
              <PointList points={c.theyreBetter} icon="dot" />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-dashed p-6">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">So which one?</h2>
            <p className="mt-2 text-muted-foreground">{c.verdict}</p>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
              Try it with your own numbers
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
              The same calculator as our{" "}
              <Link to="/tools/fee-calculator" className="text-primary underline-offset-4 hover:underline">
                fee comparison tool
              </Link>
              , with every platform in it.
            </p>
            <div className="mt-8">
              <FeeComparison initialPrice={c.preset.price} initialSales={c.preset.sales} />
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Sources:{" "}
              {c.sources.map((s, i) => (
                <span key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    {s.label}
                  </a>
                  {i < c.sources.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              Try one product first
            </h2>
            <p className="mx-auto mt-2 max-w-md text-primary-foreground/80">
              You don't have to leave {c.competitor} to find out. Nothing to pay until it sells.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to="/login">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
