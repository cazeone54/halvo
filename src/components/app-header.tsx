import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Menu, Settings, User, ExternalLink, Store, LogOut, LifeBuoy, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { BASE_URL, BRAND_EMAIL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const APP_NAV_LINKS = [
  { to: "/dashboard", label: "Products", exact: true },
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
  const storefrontUrl = profile?.handle ? `${BASE_URL}/u/${profile.handle}` : null;
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="sm:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {APP_NAV_LINKS.map((link) => (
              <DropdownMenuItem key={link.to} asChild>
                <Link to={link.to}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <Link to="/dashboard/purchases">Your purchases</Link>
            </DropdownMenuItem>
            {/* Sign out lives in here on mobile so the header doesn't run out
                of room next to the wordmark, theme toggle and menu. */}
            <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Account menu (desktop) — storefront, settings and sign-out behind an avatar. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="hidden h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-border transition-colors hover:bg-primary/20 sm:flex"
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4" />
              )}
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
