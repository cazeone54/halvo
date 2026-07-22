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
import { BRAND_NAME, BRAND_KEY } from "@/lib/site";
import { captureReferralFromUrl } from "@/lib/referral-attribution";
import { ThemeProvider } from "@/components/theme-provider";

// Applies the persisted light/dark/system choice before hydration to avoid
// a flash of the wrong theme.
const themeBootScript = `(function(){try{var t=localStorage.getItem('${BRAND_KEY}-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND_NAME} — Sell digital products in minutes` },
      {
        name: "description",
        content: `${BRAND_NAME} lets creators sell digital products with instant checkout and download delivery.`,
      },
      { name: "theme-color", content: "#1a7a7a" },
    ],
    links: [
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
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

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
      </ThemeProvider>
    </QueryClientProvider>
  );
}
