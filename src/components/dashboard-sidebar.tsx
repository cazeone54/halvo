import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ShoppingBag, Store } from "lucide-react";
import { APP_NAV_LINKS } from "@/components/app-header";
import { getMyProfile } from "@/lib/profile.functions";
import { BASE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const ITEM = "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";
const IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";

function SideLink({ link }: { link: (typeof APP_NAV_LINKS)[number] }) {
  return (
    <Link
      to={link.to}
      activeOptions={"exact" in link ? { exact: link.exact } : undefined}
      activeProps={{ className: "bg-primary/10 text-primary", "aria-current": "page" }}
      inactiveProps={{ className: IDLE }}
      className={ITEM}
    >
      <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {link.label}
    </Link>
  );
}

// The seller's menu down the left on a computer: every section in one column,
// each with its icon, always in view. Phones keep the bottom tabs and the menu
// button, and tablets the links across the header — there isn't the width.
//
// `floating`: on a public page (Discover, Help…) it's fixed to the left edge
// instead of sitting in the dashboard's two-column layout.
export function DashboardSidebar({ floating = false }: { floating?: boolean }) {
  // The same ["my-profile"] query the layout already runs, so no extra request.
  const profileFn = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shopUrl = profileQ.data?.handle ? `${BASE_URL}/${profileQ.data.handle}` : null;

  return (
    <aside
      className={cn(
        "hidden w-56 shrink-0 border-r lg:block",
        floating && "fixed bottom-0 left-0 top-14 z-[5] bg-background",
      )}
    >
      {/* Sticks under the header and scrolls on its own if the window is short. */}
      <nav
        aria-label="Dashboard"
        className={cn(
          "flex flex-col gap-1 overflow-y-auto p-3",
          floating ? "h-full" : "sticky top-14 h-[calc(100vh-3.5rem)]",
        )}
      >
        {APP_NAV_LINKS.filter((l) => l.group === "shop").map((link) => (
          <SideLink key={link.to} link={link} />
        ))}
        <div className="mx-3 my-2 border-t" />
        {APP_NAV_LINKS.filter((l) => l.group === "site").map((link) => (
          <SideLink key={link.to} link={link} />
        ))}
        <div className="mt-auto flex flex-col gap-1 border-t pt-3">
          {shopUrl ? (
            <a href={shopUrl} target="_blank" rel="noreferrer" className={`${ITEM} ${IDLE}`}>
              <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
              View my shop
              <ExternalLink className="ml-auto h-3 w-3 opacity-60" aria-hidden="true" />
            </a>
          ) : null}
          <Link
            to="/dashboard/purchases"
            activeProps={{ className: "bg-primary/10 text-primary", "aria-current": "page" }}
            inactiveProps={{ className: IDLE }}
            className={ITEM}
          >
            <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
            Your purchases
          </Link>
        </div>
      </nav>
    </aside>
  );
}
