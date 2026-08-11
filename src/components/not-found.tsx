import { Link } from "@tanstack/react-router";
import { Home, Compass, LifeBuoy } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";

// Shown for any unmatched route. Full Halvo chrome + real ways forward, so a
// mistyped or dead link reads as "wrong page" rather than "the app crashed".
export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex flex-1 items-center justify-center px-4 py-20 text-center">
        <div className="max-w-md">
          <p className="font-[family-name:var(--font-display)] text-7xl font-bold leading-none text-primary/25">
            404
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
            This page went missing.
          </h1>
          <p className="mt-2 text-muted-foreground">
            The link might be broken, or the page may have moved. Here's where to head next:
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/">
                <Home className="h-4 w-4" /> Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/discover">
                <Compass className="h-4 w-4" /> Browse products
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/guides">
                <LifeBuoy className="h-4 w-4" /> Help &amp; guides
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
