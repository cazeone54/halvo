import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Menu, Package, Tag, BarChart3, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const NAV_LINKS = [
  { to: "/dashboard", label: "Products", exact: true },
  { to: "/dashboard/discounts", label: "Discounts" },
  { to: "/dashboard/referrals", label: "Affiliate" },
  { to: "/dashboard/analytics", label: "Analytics" },
  { to: "/discover", label: "Discover" },
  { to: "/guides", label: "Help" },
  { to: "/dashboard/settings", label: "Settings" },
] as const;

// The four highest-traffic seller destinations, pinned to a thumb-reachable
// bottom tab bar on mobile — the pattern successful SaaS mobile apps use over a
// hamburger (faster, one-handed, always visible). Overflow (Affiliate,
// Discover) still lives in the top menu.
const PRIMARY_TABS = [
  { to: "/dashboard", label: "Products", icon: Package, exact: true },
  { to: "/dashboard/discounts", label: "Discounts", icon: Tag },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

function DashboardLayout() {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={"exact" in link ? { exact: link.exact } : undefined}
                activeProps={{ className: "text-foreground" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Below sm, the nav above is hidden entirely — this is the only
              way to reach Discounts/Affiliate/Analytics/Discover/Settings
              from a phone, so it isn't optional polish. */}
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
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:pb-6">
        <Outlet />
      </main>

      {/* Thumb-zone bottom navigation — mobile only. Labeled icons (not
          "mystery meat"), ≥56px tap targets, safe-area aware for notched phones. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 text-muted-foreground backdrop-blur [padding-bottom:env(safe-area-inset-bottom)] sm:hidden">
        {PRIMARY_TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={"exact" in tab ? { exact: tab.exact } : undefined}
            activeProps={{ className: "text-primary" }}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium"
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
