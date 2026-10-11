import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Package, Tag, BarChart3, Settings } from "lucide-react";
import { AppHeader } from "@/components/app-header";

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
  return (
    <div className="min-h-screen">
      <AppHeader />
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
