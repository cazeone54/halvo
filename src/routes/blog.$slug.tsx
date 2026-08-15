import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { ContentBlocks } from "@/components/content-blocks";
import { Button } from "@/components/ui/button";
import { findPost } from "@/content/blog";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = findPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const title = `${loaderData.title} — ${BRAND_NAME}`;
    const url = `${BASE_URL}/blog/${loaderData.slug}`;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "article:published_time", content: loaderData.date },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: loaderData.description },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();
  const published = new Date(post.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All posts
          </Link>

          <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">{post.description}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{published}</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {post.minutes} min read
            </span>
          </p>

          <div className="mt-2">
            <ContentBlocks blocks={post.body} />
          </div>

          <div className="mt-14 rounded-2xl border bg-muted/30 p-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Sell your first product on {BRAND_NAME}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a file, set a price, share one link. Free to start.
            </p>
            <Button asChild className="mt-4">
              <Link to="/login">Get started</Link>
            </Button>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
