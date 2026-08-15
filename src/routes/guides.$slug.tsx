import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { ContentBlocks } from "@/components/content-blocks";
import { findGuide } from "@/content/guides";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ params }) => {
    const guide = findGuide(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const title = `${loaderData.title} — ${BRAND_NAME}`;
    const url = `${BASE_URL}/guides/${loaderData.slug}`;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: loaderData.description },
      ],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const guide = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            to="/guides"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All guides
          </Link>

          <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">{guide.description}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {guide.minutes} min read
          </p>

          <div className="mt-2">
            <ContentBlocks blocks={guide.body} />
          </div>

          <div className="mt-14 rounded-2xl border bg-muted/30 p-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">Ready to try it?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your first product can be live in a few minutes. Free to start.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
            >
              Get started
            </Link>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
