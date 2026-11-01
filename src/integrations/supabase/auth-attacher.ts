import { createMiddleware } from "@tanstack/react-start";
import { hasStoredSession } from "@/lib/stored-session";

// Registered as a global functionMiddleware in src/start.ts — attaches the
// current session's bearer token to every server-fn RPC call. With no saved
// session there's nothing to attach, so the Supabase client isn't loaded.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (!hasStoredSession()) return next();
  const { supabase } = await import("./client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
