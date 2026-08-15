import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { ContentBlocks } from "@/components/content-blocks";
import { Button } from "@/components/ui/button";
import { findPost, BLOG_POSTS } from "@/content/blog";
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
    // BlogPosting structured data → eligible for article rich results. No
    // per-post author/image, so the brand is author+publisher and the default
    // OG card is the image.
    const articleLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: loaderData.title,
      description: loaderData.description,
      datePublished: loaderData.date,
      dateModified: loaderData.date,
      image: `${BASE_URL}/og.png`,
      author: { "@type": "Organization", name: BRAND_NAME, url: BASE_URL },
      publisher: {
        "@type": "Organization",
        name: BRAND_NAME,
        logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    };
    return {
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(articleLd) }],
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

  // A few other posts to keep readers on the site — internal links help SEO and
  // engagement. Newest first, excluding the current post.
  const moreReading = BLOG_POSTS.filter((p) => p.slug !== post.slug)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);

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

          {moreReading.length > 0 ? (
            <section className="mt-14" aria-labelledby="keep-reading">
              <h2
                id="keep-reading"
                className="font-[family-name:var(--font-display)] text-lg font-semibold"
              >
                Keep reading
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                {moreReading.map((p) => (
                  <Link
                    key={p.slug}
                    to="/blog/$slug"
                    params={{ slug: p.slug }}
                    className="group rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <p className="font-medium group-hover:text-primary">{p.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {p.minutes} min read
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
