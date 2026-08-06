import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { BRAND_NAME, BRAND_KEY, BASE_URL } from "@/lib/site";
import { captureReferralFromUrl } from "@/lib/referral-attribution";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToaster } from "@/components/app-toaster";

// Applies the persisted light/dark/system choice before hydration to avoid
// a flash of the wrong theme.
const themeBootScript = `(function(){try{var t=localStorage.getItem('${BRAND_KEY}-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Don't leak the full URL (which can carry a capability token, e.g. the
      // /success?id= transaction id or a signed download URL) to third parties
      // via the Referer header. Sends only the origin cross-origin.
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { title: `${BRAND_NAME} — Sell digital products in minutes` },
      {
        name: "description",
        content: `${BRAND_NAME} lets creators sell digital products with instant checkout and download delivery.`,
      },
      { name: "theme-color", content: "#1a7a7a" },
      // Default social-share card for every page. Product/storefront pages set
      // their own og:image (more specific); this is the baseline so sharing the
      // marketing site — or an ad's link preview — never shows a bare card.
      // Add a 1200x630 public/og.png (see the OG cover artifact) for the image.
      { property: "og:site_name", content: BRAND_NAME },
      { property: "og:type", content: "website" },
      { property: "og:title", content: `${BRAND_NAME} — Sell digital products in minutes` },
      {
        property: "og:description",
        content: `Instant Stripe checkout, instant delivery, and payouts to your own account. From 4% a sale.`,
      },
      { property: "og:image", content: `${BASE_URL}/og.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${BASE_URL}/og.png` },
    ],
    links: [
      // Manrope — the intended display typeface (referenced by --font-display
      // but not previously loaded, so headings + the wordmark were silently
      // falling back to a system font). Loading it makes the logo and all
      // display type render as designed.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <a href="/" className="text-primary underline underline-offset-4">
        Go home
      </a>
    </div>
  ),
  errorComponent: ({ error, reset }) => <RootError error={error} reset={reset} />,
});

// A visitor should never see a raw exception string — it's unpolished and can
// leak internals (a Supabase/Stripe error message). Log the detail for us, show
// the visitor a calm message plus real ways to recover.
function RootError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An unexpected error occurred on our end. Please try again.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
        <a href="/" className="text-sm text-primary underline underline-offset-4">
          Go home
        </a>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
        <AppToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
