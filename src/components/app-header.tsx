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
  House,
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

// The seller's menu, in groups with a heading each (like Discover's filters).
// Products, Sales and Payouts each have their own page, so a sale someone was
// just emailed about is one click away under Sales.
export const APP_NAV_GROUPS = [
  { id: "sell", title: "Sell" },
  { id: "grow", title: "Grow" },
  { id: "account", title: "Account" },
  { id: "site", title: "Halvo" },
] as const;

export const APP_NAV_LINKS = [
  { to: "/dashboard", label: "Home", exact: true, icon: House, group: "sell" },
  { to: "/dashboard/products", label: "Products", icon: Package, group: "sell" },
  { to: "/dashboard/sales", label: "Sales", icon: Receipt, group: "sell" },
  { to: "/dashboard/customers", label: "Customers", icon: Users, group: "sell" },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, group: "grow" },
  { to: "/dashboard/discounts", label: "Discounts", icon: Tag, group: "grow" },
  { to: "/dashboard/referrals", label: "Affiliate", icon: Handshake, group: "grow" },
  { to: "/dashboard/payouts", label: "Payouts", icon: Wallet, group: "account" },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, group: "account" },
  { to: "/discover", label: "Discover", icon: Compass, group: "site" },
  { to: "/guides", label: "Help", icon: LifeBuoy, group: "site" },
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
        {/* Below sm, the nav above is hidden entirely — this is the only way to
            reach every section from a phone, so it isn't optional polish. */}
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
            // The same groups as the side menu. Smaller rows than the public
            // menu's, so all eleven fit on a phone with little scrolling.
            APP_NAV_GROUPS.map((group) => (
              <div key={group.id} role="group" aria-label={group.title} className="pb-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                {APP_NAV_LINKS.filter((link) => link.group === group.id).map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={close}
                    className={cn(MOBILE_MENU_LINK, "gap-3 py-2.5 text-lg")}
                    activeOptions={"exact" in link ? { exact: link.exact } : undefined}
                    activeProps={{ className: MOBILE_MENU_LINK_ACTIVE, "aria-current": "page" }}
                  >
                    <link.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {link.label}
                  </Link>
                ))}
              </div>
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
