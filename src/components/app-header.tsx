import { Fragment } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  ExternalLink,
  Store,
  LogOut,
  LifeBuoy,
  ShoppingBag,
  LayoutDashboard,
  Package,
  Receipt,
  Wallet,
  Tag,
  Handshake,
  BarChart3,
  Users,
  Compass,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { getMyProfile } from "@/lib/profile.functions";
import { BASE_URL, BRAND_EMAIL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileMenu, MOBILE_MENU_LINK, MOBILE_MENU_LINK_ACTIVE } from "@/components/mobile-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// One list, most-used first: Products, Sales and Payouts each have their own
// page, so the sale a seller was just emailed about is one click away. The
// "more" group (Discover, Help, Settings) sits below a line at the bottom.
export const APP_NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", exact: true, icon: LayoutDashboard, group: "main" },
  { to: "/dashboard/products", label: "Products", icon: Package, group: "main" },
  { to: "/dashboard/sales", label: "Sales", icon: Receipt, group: "main" },
  { to: "/dashboard/customers", label: "Customers", icon: Users, group: "main" },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, group: "main" },
  { to: "/dashboard/discounts", label: "Discounts", icon: Tag, group: "main" },
  { to: "/dashboard/referrals", label: "Affiliate", icon: Handshake, group: "main" },
  { to: "/dashboard/payouts", label: "Payouts", icon: Wallet, group: "main" },
  { to: "/discover", label: "Discover", icon: Compass, group: "more" },
  { to: "/guides", label: "Help", icon: LifeBuoy, group: "more" },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, group: "more" },
] as const;

// The signed-in header. Used by the dashboard and by every public page while a
// seller is signed in, so moving to Discover or Help keeps their navigation
// and account menu instead of looking like they were logged out.
//
// `sideNav`: the page has the menu down the left on a wide screen (the
// dashboard). Too many links to fit across the top, so below that width they
// sit behind the menu button instead.
export function AppHeader({ sideNav = false }: { sideNav?: boolean }) {
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const profile = profileQ.data;
  const storefrontUrl = profile?.handle ? `${BASE_URL}/${profile.handle}` : null;
  const displayName = profile?.display_name || profile?.handle || "Your account";

  const signOut = async () => {
    // Loaded on demand: this header is part of the script every page loads.
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="app-header sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-6">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <nav className={cn("hidden gap-4 text-sm text-muted-foreground", !sideNav && "sm:flex")}>
          {APP_NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={"exact" in link ? { exact: link.exact } : undefined}
              activeProps={{ className: "text-foreground", "aria-current": "page" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {/* Wherever the links above are hidden (phones; tablets too on pages
            with the side menu) this is the only way to reach every section,
            so it isn't optional polish. */}
        <MobileMenu
          homeTo="/dashboard"
          until={sideNav ? "lg" : "sm"}
          footer={(close) => (
            <>
              <div className="flex items-center gap-3 pb-1">
                <UserAvatar
                  src={profile?.avatarUrl}
                  name={profile?.display_name || profile?.handle}
                  className="h-10 w-10 bg-primary/10 text-primary ring-1 ring-border"
                  textClassName="text-sm"
                  iconClassName="h-5 w-5"
                />
                <span className="min-w-0 truncate font-medium">{displayName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="h-11">
                  <Link to="/dashboard/purchases" onClick={close}>
                    <ShoppingBag className="h-4 w-4" /> Purchases
                  </Link>
                </Button>
                {storefrontUrl ? (
                  <Button asChild variant="outline" className="h-11">
                    <a href={storefrontUrl} target="_blank" rel="noreferrer" onClick={close}>
                      <Store className="h-4 w-4" /> My shop
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="h-11">
                    <a href={`mailto:${BRAND_EMAIL}`} onClick={close}>
                      <LifeBuoy className="h-4 w-4" /> Support
                    </a>
                  </Button>
                )}
              </div>
              {/* Sign out lives in here on mobile so the header doesn't run out
                  of room next to the wordmark, theme toggle and menu. */}
              <Button
                variant="ghost"
                className="h-11 w-full text-muted-foreground"
                onClick={() => {
                  close();
                  void signOut();
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          )}
        >
          {(close) =>
            APP_NAV_LINKS.map((link, i) => (
              <Fragment key={link.to}>
                {/* The same line as the side menu, above Discover, Help and Settings. */}
                {link.group === "more" && APP_NAV_LINKS[i - 1]?.group === "main" ? (
                  <div className="mx-3 my-2 border-t" />
                ) : null}
                <Link
                  to={link.to}
                  onClick={close}
                  className={MOBILE_MENU_LINK}
                  activeOptions={"exact" in link ? { exact: link.exact } : undefined}
                  activeProps={{ className: MOBILE_MENU_LINK_ACTIVE, "aria-current": "page" }}
                >
                  {link.label}
                </Link>
              </Fragment>
            ))
          }
        </MobileMenu>
        {/* Account menu (desktop) — storefront, settings and sign-out behind an avatar. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="hidden shrink-0 rounded-full transition-opacity hover:opacity-80 sm:flex"
            >
              <UserAvatar
                src={profile?.avatarUrl}
                name={profile?.display_name || profile?.handle}
                className="h-8 w-8 bg-primary/10 text-primary ring-1 ring-border"
                textClassName="text-[11px]"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {storefrontUrl ? (
              <DropdownMenuItem asChild>
                <a href={storefrontUrl} target="_blank" rel="noreferrer">
                  <Store className="h-4 w-4" /> View my shop
                  <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
                </a>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link to="/dashboard/purchases">
                <ShoppingBag className="h-4 w-4" /> Your purchases
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`mailto:${BRAND_EMAIL}`}>
                <LifeBuoy className="h-4 w-4" /> Contact support
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
