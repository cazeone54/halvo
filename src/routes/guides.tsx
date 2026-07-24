import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent } from "@/components/ui/card";
import { GUIDES, type Guide } from "@/content/guides";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/guides")({
  head: () => ({
    meta: [
      { title: `Guides — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Short, practical guides for selling digital products on ${BRAND_NAME}: publishing your first product, connecting Stripe, fees, discounts, affiliates and refunds.`,
      },
      { property: "og:title", content: `Guides — ${BRAND_NAME}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/guides` },
    ],
  }),
  component: GuidesIndex,
});

const CATEGORY_ORDER: Guide["category"][] = ["Getting started", "Getting paid", "Growing sales"];

function GuidesIndex() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <div className="border-b bg-hero-glow">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
              Guides
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Everything you need to sell your first product and get paid — in plain language, no jargon.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
          {CATEGORY_ORDER.map((category) => {
            const guides = GUIDES.filter((g) => g.category === category);
            if (guides.length === 0) return null;
            return (
              <section key={category} className="mb-12 last:mb-0">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">{category}</h2>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {guides.map((guide) => (
                    <Link key={guide.slug} to="/guides/$slug" params={{ slug: guide.slug }}>
                      <Card className="card-hover transition-transform duration-200 hover:-translate-y-0.5">
                        <CardContent className="flex items-start justify-between gap-4 p-5">
                          <div className="min-w-0">
                            <h3 className="font-[family-name:var(--font-display)] font-semibold">{guide.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {guide.minutes} min read
                            </p>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
