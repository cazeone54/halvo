import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND_NAME } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

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
            <Link to="/dashboard" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
              Products
            </Link>
            <Link to="/dashboard/discounts" activeProps={{ className: "text-foreground" }}>
              Discounts
            </Link>
            <Link to="/dashboard/referrals" activeProps={{ className: "text-foreground" }}>
              Affiliate
            </Link>
            <Link to="/dashboard/analytics" activeProps={{ className: "text-foreground" }}>
              Analytics
            </Link>
            <Link to="/discover" activeProps={{ className: "text-foreground" }}>
              Discover
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
