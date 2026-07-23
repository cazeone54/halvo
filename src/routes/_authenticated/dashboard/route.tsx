import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND_NAME } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const NAV_LINKS = [
  { to: "/dashboard", label: "Products", exact: true },
  { to: "/dashboard/discounts", label: "Discounts" },
  { to: "/dashboard/referrals", label: "Affiliate" },
  { to: "/dashboard/analytics", label: "Analytics" },
  { to: "/discover", label: "Discover" },
  { to: "/dashboard/settings", label: "Settings" },
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
          <Link to="/dashboard" className="font-[family-name:var(--font-display)] font-semibold">
            {BRAND_NAME}
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
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
