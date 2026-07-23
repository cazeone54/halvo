import { Link } from "@tanstack/react-router";
import { BRAND_NAME } from "@/lib/site";
import { LogoMark } from "@/components/logo";

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />© {new Date().getFullYear()} {BRAND_NAME}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/pricing">Pricing</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refund-policy">Refund policy</Link>
        </nav>
      </div>
    </footer>
  );
}
