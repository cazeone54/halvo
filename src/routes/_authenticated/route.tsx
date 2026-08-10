import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Use the locally persisted (auto-refreshing) session instead of a network
    // getUser() call. A brief Supabase/network hiccup was able to falsely bounce
    // a signed-in seller to /login. This is only a UI routing gate — the real
    // security is server-side: every server function re-validates the JWT
    // signature in requireSupabaseAuth, so a stale local session can't do
    // anything privileged.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
