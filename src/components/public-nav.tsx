import { Link } from "@tanstack/react-router";
import { useAuthState } from "@/lib/auth-state";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { MobileMenu, MOBILE_MENU_LINK, MOBILE_MENU_LINK_ACTIVE } from "@/components/mobile-menu";

const NAV_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/guides", label: "Guides" },
  { to: "/blog", label: "Blog" },
  { to: "/faq", label: "FAQ" },
  { to: "/discover", label: "Discover" },
] as const;

export function PublicNav() {
  // A signed-in seller keeps their own header (navigation, account menu,
  // sign out) on every public page — swapping it for the marketing header made
  // Discover and Help look like they'd logged you out.
  const auth = useAuthState();
  if (auth === "in") return <AppHeader />;

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: "text-foreground", "aria-current": "page" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {/* Hidden (not removed) until the session check finishes, so a
              signed-in seller never sees a flash of "Sign in" and the layout
              doesn't jump. */}
          <div className={cn("flex items-center gap-1 sm:gap-2", auth === "unknown" && "invisible")}>
            {/* Sign in is secondary — on a phone it just crowds out the
                primary CTA, and it's still reachable from the menu below. */}
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Get started</Link>
            </Button>
          </div>

          {/* Below sm the nav above is hidden entirely, so without this menu
              Pricing/Guides/FAQ/Discover are unreachable on a phone. */}
          <MobileMenu
            homeTo="/"
            footer={(close) => (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link to="/login" onClick={close}>
                    Get started
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link to="/login" onClick={close}>
                    Sign in
                  </Link>
                </Button>
              </>
            )}
          >
            {(close) =>
              NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={close}
                  className={MOBILE_MENU_LINK}
                  activeProps={{ className: MOBILE_MENU_LINK_ACTIVE, "aria-current": "page" }}
                >
                  {link.label}
                </Link>
              ))
            }
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
