import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // With React Query's default staleTime of 0, every dashboard tab switch and
  // every return to the browser tab refetched everything on screen. 30s keeps
  // switching instant; mutations still invalidate what they change.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading a page's code and data when a link is hovered or touched,
    // so navigation usually finishes before the click does.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
