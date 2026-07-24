import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_POSTS } from "@/content/blog";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

// Must be an *index* route (blog.index.tsx), not blog.tsx. As blog.tsx it
// became the parent layout of blog.$slug.tsx, and with no <Outlet /> the
// article never rendered — clicking a post changed the URL and nothing else.
export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: `Blog — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Practical writing on selling digital products: what to sell, how to price it, and how to get paid without building a store.",
      },
      { property: "og:title", content: `Blog — ${BRAND_NAME}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/blog` },
    ],
  }),
  component: BlogIndex,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function BlogIndex() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <div className="border-b bg-hero-glow">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
              Blog
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Practical writing on making and selling digital products — what to sell, what to charge, and how to
              get paid.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-1 gap-3">
            {posts.map((post) => (
              <Link key={post.slug} to="/blog/$slug" params={{ slug: post.slug }}>
                <Card className="card-hover transition-transform duration-200 hover:-translate-y-0.5">
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <h2 className="font-[family-name:var(--font-display)] font-semibold">{post.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{post.description}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDate(post.date)}</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {post.minutes} min read
                        </span>
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
