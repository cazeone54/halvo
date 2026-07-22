import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/site";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {BRAND_NAME}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link to="/pricing" activeProps={{ className: "text-foreground" }}>
            Pricing
          </Link>
          <Link to="/faq" activeProps={{ className: "text-foreground" }}>
            FAQ
          </Link>
          <Link to="/discover" activeProps={{ className: "text-foreground" }}>
            Discover
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/login">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
