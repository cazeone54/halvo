import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { parseOtpType, safeNextPath } from "@/lib/auth-confirm";

// The page sign-in and confirmation emails link to. See @/lib/auth-confirm.
export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({ meta: [{ title: "Signing you in…" }, { name: "robots", content: "noindex" }] }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { token_hash, type, next } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // A token can only be used once. Without this guard React's dev-mode double
  // effect (or a re-render) would spend it on the first call and fail the
  // second, showing an error to someone who is in fact signed in.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const otpType = parseOtpType(type);
    if (!token_hash || !otpType) {
      setError("This sign-in link is incomplete. Request a new one and use the newest email.");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: otpType });
      if (error) {
        setError(
          /expired|invalid/i.test(error.message)
            ? "This link has expired or was already used. Request a new one — only the newest link works."
            : error.message,
        );
        return;
      }
      navigate({ to: safeNextPath(next), replace: true });
    })();
  }, [token_hash, type, next, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Link to="/">
        <Logo markClassName="h-8 w-8" />
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1" className="font-[family-name:var(--font-display)] text-xl">
            {error ? "Couldn't sign you in" : "Signing you in…"}
          </CardTitle>
          <CardDescription>{error ?? "One moment."}</CardDescription>
        </CardHeader>
        {error ? (
          <CardContent>
            <Link to="/login" className="text-sm text-primary underline underline-offset-4">
              Get a new sign-in link
            </Link>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
