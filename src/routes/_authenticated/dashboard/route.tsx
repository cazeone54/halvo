import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Package, Tag, BarChart3, Settings, PauseCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { getMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

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
  // Reuses the ["my-profile"] query the settings page already loads, so this
  // costs nothing extra once that's cached. A deactivated seller otherwise has
  // no way to tell their shop is hidden except by noticing sales stopped.
  const profileFn = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const deactivated = !!profileQ.data?.deactivated_at;

  return (
    <div className="min-h-screen">
      <AppHeader />

      {deactivated ? (
        <div className="border-b border-amber-500/40 bg-amber-500/10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm sm:px-6">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">Your account is deactivated.</span>
            <span className="text-muted-foreground">Nothing is for sale and your storefront is hidden.</span>
            <Link to="/dashboard/settings" className="font-medium underline underline-offset-2">
              Reactivate
            </Link>
          </div>
        </div>
      ) : null}

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:pb-6">
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
            activeProps={{ className: "text-primary", "aria-current": "page" }}
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
