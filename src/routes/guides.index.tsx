import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent } from "@/components/ui/card";
import { GUIDES, type Guide } from "@/content/guides";
import { AUDIENCES } from "@/content/audiences";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

// Index route (guides.index.tsx), not guides.tsx — see the note in
// blog.index.tsx. As guides.tsx it silently swallowed guides.$slug.tsx.
export const Route = createFileRoute("/guides/")({
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
    links: [{ rel: "canonical", href: `${BASE_URL}/guides` }],
  }),
  component: GuidesIndex,
});

const CATEGORY_ORDER: Guide["category"][] = ["Getting started", "Getting paid", "Growing sales"];

function GuidesIndex() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
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

        {/* The audience pages came off the footer, where they were on every
            page of the site. They still need one link a crawler can follow, and
            this is the right page for it: someone reading the guides is exactly
            who they were written for. */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
              Selling something specific?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A short page on how it works for what you make.
            </p>
            <nav className="mt-4 flex flex-wrap gap-2">
              {AUDIENCES.map((audience) => (
                <Link
                  key={audience.slug}
                  to="/for/$slug"
                  params={{ slug: audience.slug }}
                  className="rounded-full border bg-card px-3 py-1.5 text-sm capitalize text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {audience.noun}
                </Link>
              ))}
            </nav>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
