import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useAuthState } from "@/lib/auth-state";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="sm:hidden">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.to} asChild>
                  <Link to={link.to}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link to="/login">Sign in</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
