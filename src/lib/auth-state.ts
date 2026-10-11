import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

// Whether a seller is signed in, shared by every header on the site. The
// session lives in localStorage, so the server can't know it: the server
// render (and hydration) see "unknown", and the client resolves it right after.
// Kept at module level, so once known it's known instantly on every later
// client-side navigation — Discover/Help no longer flash a signed-out header.
export type AuthState = "unknown" | "in" | "out";

let state: AuthState = "unknown";
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => set(data.session ? "in" : "out"));
  supabase.auth.onAuthStateChange((_event, session) => set(session ? "in" : "out"));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
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
  set("in");
  start();
}
