import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ProviderIcon } from "@/components/provider-icon";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { GOOGLE_CLIENT_ID } from "@/lib/google-identity";
import { parseEnabledProviders, type AuthProviderId } from "@/lib/auth-providers";
import { BRAND_NAME } from "@/lib/site";
import { readArrival } from "@/lib/signup-arrival";

export const Route = createFileRoute("/login")({
  // Its own name in the browser tab, rather than the homepage's.
  head: () => ({ meta: [{ title: `Sign in — ${BRAND_NAME}` }] }),
  component: LoginPage,
});

// Which social buttons to show — see @/lib/auth-providers. Read at module scope
// because it's build-time config, not state.
const PROVIDERS = parseEnabledProviders(import.meta.env.VITE_AUTH_PROVIDERS as string | undefined);

function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  // Google's own button replaces the redirect one when a client id is set, but
  // falls back to it if their script can't load (ad blocker, offline).
  const [googleScriptFailed, setGoogleScriptFailed] = useState(false);
  const useGoogleIdToken = !!GOOGLE_CLIENT_ID && !googleScriptFailed;

  const signInWith = async (provider: AuthProviderId) => {
    setError(null);
    setPending(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    // On success the browser leaves for the provider, so this only runs on
    // failure — most often because the provider isn't enabled in Supabase.
    if (error) {
      setError(error.message);
      setPending(null);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        // Saved on the account only if this creates it (Supabase ignores it
        // for existing users), so the sign-up keeps its source even when the
        // link is opened in the mail app's browser. See signup-source.functions.ts.
        data: { halvo_arrival: readArrival() ?? undefined },
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  // Centred on a desktop, but anchored near the top on a phone: a centred card
  // is re-centred when the on-screen keyboard opens, so the form slid up as
  // soon as the email field was tapped.
  return (
    <div className="flex min-h-screen flex-col items-center justify-start gap-6 px-4 pb-10 pt-12 sm:justify-center sm:pb-0 sm:pt-0">
      <Link to="/">
        <Logo markClassName="h-8 w-8" />
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1" className="font-[family-name:var(--font-display)] text-xl">
            Sign in or create your account
          </CardTitle>
          <CardDescription>
            One step, no password. New to {BRAND_NAME}? This creates your account. Already have one? It signs you in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((p) =>
              // Google gets its own button when the ID-token flow is configured:
              // that keeps the consent popup on this domain instead of showing
              // the visitor a supabase.co host they've never heard of.
              p.id === "google" && useGoogleIdToken ? (
                <GoogleSignInButton key={p.id} onUnavailable={() => setGoogleScriptFailed(true)} />
              ) : (
                <Button
                  key={p.id}
                  variant="outline"
                  onClick={() => signInWith(p.id)}
                  disabled={pending !== null}
                >
                  <ProviderIcon id={p.id} />
                  {pending === p.id ? `Opening ${p.name}…` : `Continue with ${p.name}`}
                </Button>
              ),
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          {sent ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                Check <span className="font-medium text-foreground">{email}</span> for your sign-in link. It can take a
                minute to arrive, and it may land in spam.
              </p>
              {/* Don't strand someone who mistyped their email — let them go
                  back to the form (email preserved) to fix it or resend. */}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
                className="self-start text-primary underline underline-offset-4"
              >
                Wrong email, or didn't get it?
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={sendMagicLink}>
              <Input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Continue with email"}
              </Button>
              <p className="text-xs text-muted-foreground">
                We'll email you a secure link — no password to set or remember.
              </p>
            </form>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
