// Whether this browser holds a saved sign-in, read straight from localStorage,
// where the Supabase client keeps it ("sb-<project>-auth-token"). Lets public
// pages skip downloading the Supabase client — a third of the site's main
// script — for visitors who aren't signed in, which is nearly all of them.
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.+-auth-token$/.test(localStorage.key(i) ?? "")) return true;
    }
  } catch {
    // Storage blocked: the client couldn't have saved a session there either.
  }
  return false;
}
