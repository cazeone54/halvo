import { Link } from "@tanstack/react-router";
import { BRAND_NAME, BRAND_EMAIL } from "@/lib/site";
import { LogoMark } from "@/components/logo";
import { AUDIENCES } from "@/content/audiences";

export function PublicFooter() {
  return (
    <footer className="border-t">
      {/* Audience pages are an organic-search surface; they need a crawlable
          link from every page, not just a sitemap entry. */}
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Built for</p>
        <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {AUDIENCES.map((audience) => (
            <Link key={audience.slug} to="/for/$slug" params={{ slug: audience.slug }} className="capitalize">
              {audience.noun}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />© {new Date().getFullYear()} {BRAND_NAME}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/pricing">Pricing</Link>
          <Link to="/guides">Guides</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/faq">FAQ</Link>
          <a href={`mailto:${BRAND_EMAIL}`} className="font-medium text-foreground hover:text-primary">
            Contact
          </a>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refund-policy">Refund policy</Link>
        </nav>
      </div>
    </footer>
  );
}
