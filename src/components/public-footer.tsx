import { Link } from "@tanstack/react-router";
import { BRAND_NAME } from "@/lib/site";
import { LogoMark } from "@/components/logo";

// The "Built for" row of audience links used to sit above this. Those pages
// are now campaign landing pages — somewhere an ad or a DM sends one kind of
// creator — rather than site furniture on every page. They stay live and in
// the sitemap, and the Guides index carries their one crawlable link.
export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />© {new Date().getFullYear()} {BRAND_NAME}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/pricing">Pricing</Link>
          <Link to="/guides">Guides</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/access">Recover a purchase</Link>
          {/* A form, not a mailto: a mailto does nothing at all on a phone
              with no mail app set up, and silently loses the question. */}
          <Link to="/contact" className="font-medium text-foreground hover:text-primary">
            Contact
          </Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refund-policy">Refund policy</Link>
        </nav>
      </div>
    </footer>
  );
}
