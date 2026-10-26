import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Settings, ExternalLink, Store, LogOut, LifeBuoy, ShoppingBag } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { BASE_URL, BRAND_EMAIL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
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

export const APP_NAV_LINKS = [
  // "Dashboard", not "Products": this page carries the KPIs, the products list
  // AND the sales list, so labelling it after one of them sent sellers hunting
  // under Analytics or Customers for the sale they'd just been emailed about.
  { to: "/dashboard", label: "Dashboard", exact: true },
  { to: "/dashboard/discounts", label: "Discounts" },
  { to: "/dashboard/referrals", label: "Affiliate" },
  { to: "/dashboard/analytics", label: "Analytics" },
  { to: "/dashboard/customers", label: "Customers" },
  { to: "/discover", label: "Discover" },
  { to: "/guides", label: "Help" },
  { to: "/dashboard/settings", label: "Settings" },
] as const;

// The signed-in header. Used by the dashboard and by every public page while a
// seller is signed in, so moving to Discover or Help keeps their navigation
// and account menu instead of looking like they were logged out.
export function AppHeader() {
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const profile = profileQ.data;
  const storefrontUrl = profile?.handle ? `${BASE_URL}/${profile.handle}` : null;
  const displayName = profile?.display_name || profile?.handle || "Your account";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-6">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
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
                      <Store className="h-4 w-4" /> Storefront
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
            APP_NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={close}
                className={MOBILE_MENU_LINK}
                activeOptions={"exact" in link ? { exact: link.exact } : undefined}
                activeProps={{ className: MOBILE_MENU_LINK_ACTIVE, "aria-current": "page" }}
              >
                {link.label}
              </Link>
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
                  <Store className="h-4 w-4" /> View storefront
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
