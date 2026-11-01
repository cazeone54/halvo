import { useSyncExternalStore } from "react";
import { hasStoredSession } from "@/lib/stored-session";

// Whether a seller is signed in, shared by every header on the site. The
// session lives in localStorage, so the server can't know it: the server
// render (and hydration) see "unknown", and the client resolves it right after.
// Kept at module level, so once known it's known instantly on every later
// client-side navigation — Discover/Help no longer flash a signed-out header.
export type AuthState = "unknown" | "in" | "out";

let state: AuthState = "unknown";
let started = false;
let watching = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}

// Follow the Supabase client's own view of the session (it refreshes tokens
// and notices sign-outs). Loaded on demand: a visitor with no saved session
// doesn't download it just to learn they're signed out.
function watchClient() {
  if (watching) return;
  watching = true;
  void import("@/integrations/supabase/client").then(({ supabase }) => {
    supabase.auth.getSession().then(({ data }) => set(data.session ? "in" : "out"));
    supabase.auth.onAuthStateChange((_event, session) => set(session ? "in" : "out"));
  });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (hasStoredSession()) return watchClient();
  set("out");
  // Signed in from another tab: catch up.
  window.addEventListener("storage", function onStorage() {
    if (!hasStoredSession()) return;
    window.removeEventListener("storage", onStorage);
    watchClient();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

export function useAuthState(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => "unknown",
  );
}

// The dashboard gate already knows the answer — record it so the first public
// page visited afterwards renders the signed-in header immediately.
export function markSignedIn() {
  started = true;
  set("in");
  watchClient();
}
