import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ProviderIcon } from "@/components/provider-icon";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { BotCheck, BOT_CHECK_ON, type BotCheckHandle } from "@/components/bot-check";
import { GOOGLE_CLIENT_ID } from "@/lib/google-identity";
import { parseEnabledProviders, type AuthProviderId } from "@/lib/auth-providers";
import { detectInAppBrowser, openInChromeUrl, type InAppBrowser } from "@/lib/in-app-browser";
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

const BOT_CHECK_WAIT = "One moment — a quick security check is still running. Please try again in a second.";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  // Google's own button replaces the redirect one when a client id is set, but
  // falls back to it if their script can't load (ad blocker, offline).
  const [googleScriptFailed, setGoogleScriptFailed] = useState(false);
  const useGoogleIdToken = !!GOOGLE_CLIENT_ID && !googleScriptFailed;
  const onGoogleUnavailable = useCallback(() => setGoogleScriptFailed(true), []);

  const botCheck = useRef<BotCheckHandle>(null);
  const [botCheckBlocked, setBotCheckBlocked] = useState(false);
  const captchaToken = useCallback(() => botCheck.current?.token() ?? null, []);
  const resetCaptcha = useCallback(() => botCheck.current?.reset(), []);

  // Read after mount, not during render: the server has no user agent to
  // match, and a different first paint would break hydration.
  const [inApp, setInApp] = useState<InAppBrowser | null>(null);
  useEffect(() => setInApp(detectInAppBrowser(navigator.userAgent)), []);

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

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const captcha = captchaToken();
    if (BOT_CHECK_ON && !captcha) {
      setError(BOT_CHECK_WAIT);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        // Saved on the account only if this creates it (Supabase ignores it
        // for existing users), so the sign-up keeps its source even when the
        // link is opened in the mail app's browser. See signup-source.functions.ts.
        data: { halvo_arrival: readArrival() ?? undefined },
        captchaToken: captcha ?? undefined,
      },
    });
    resetCaptcha();
    setLoading(false);
    if (error) setError(error.message);
    else {
      setCode("");
      setSent(true);
    }
  };

  // The code typed here signs the visitor in on THIS page. The link in the
  // same email still works, but it opens in the phone's default browser —
  // leaving someone who came from an Instagram ad signed in somewhere else
  // than where they started. Typing the code keeps them where they are.
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setVerifying(false);
    if (error) {
      setError(
        /expired/i.test(error.message)
          ? "That code has expired. Ask for a new one below."
          : "That code didn't work. Check it, or use the code from the newest email.",
      );
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const providerButtons = (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map((p) =>
        // Google gets its own button when the ID-token flow is configured:
        // that keeps the consent popup on this domain instead of showing
        // the visitor a supabase.co host they've never heard of.
        p.id === "google" && useGoogleIdToken ? (
          <GoogleSignInButton
            key={p.id}
            onUnavailable={onGoogleUnavailable}
            captchaToken={BOT_CHECK_ON ? captchaToken : undefined}
            onCaptchaUsed={resetCaptcha}
          />
        ) : (
          <Button key={p.id} variant="outline" onClick={() => signInWith(p.id)} disabled={pending !== null}>
            <ProviderIcon id={p.id} />
            {pending === p.id ? `Opening ${p.name}…` : `Continue with ${p.name}`}
          </Button>
        ),
      )}
    </div>
  );

  const divider = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      or
      <div className="h-px flex-1 bg-border" />
    </div>
  );

  const emailBlock = sent ? (
    <form className="flex flex-col gap-3" onSubmit={verifyCode}>
      <p className="text-sm text-muted-foreground">
        We sent an email to <span className="font-medium text-foreground [overflow-wrap:anywhere]">{email}</span>.
        Type the code from it here:
      </p>
      <Input
        // The phone offers the code from the email above the keyboard.
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={10}
        placeholder="123456"
        aria-label="Code from the email"
        className="text-center text-lg tracking-[0.3em] tabular-nums"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        autoFocus
      />
      <Button type="submit" disabled={code.length < 6 || verifying}>
        {verifying ? "Checking…" : "Sign in"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Or tap the link in the email. It can take a minute to arrive, and it may land in spam.
      </p>
      {/* Don't strand someone who mistyped their email — let them go back to
          the form (email preserved) to fix it or ask for a new code. */}
      <button
        type="button"
        onClick={() => {
          setSent(false);
          setError(null);
        }}
        className="self-start text-sm text-primary underline underline-offset-4"
      >
        Wrong email, or didn't get it?
      </button>
    </form>
  ) : (
    <form className="flex flex-col gap-3" onSubmit={sendCode}>
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
      <p className="text-xs text-muted-foreground">We'll email you a code — no password to set or remember.</p>
    </form>
  );

  // Centred on a desktop, but anchored near the top on a phone: a centred card
  // is re-centred when the on-screen keyboard opens, so the form slid up as
  // soon as the email field was tapped.
  return (
    <div className="flex min-h-screen flex-col items-center justify-start gap-6 px-4 pb-10 pt-12 sm:justify-center sm:pb-0 sm:pt-0">
      <Link to="/">
        <Logo markClassName="h-8 w-8" />
      </Link>
      {inApp ? <InAppNotice browser={inApp} /> : null}
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
          {/* Inside an app's browser, Google sign-in usually fails — so the
              email code comes first there, and Google after it. */}
          {inApp ? (
            <>
              {emailBlock}
              {divider}
              {providerButtons}
            </>
          ) : (
            <>
              {providerButtons}
              {divider}
              {emailBlock}
            </>
          )}

          <BotCheck ref={botCheck} onBlocked={() => setBotCheckBlocked(true)} />
          {botCheckBlocked ? (
            <p className="text-sm text-destructive">
              Our security check couldn't load. If you use an ad or content blocker, pause it for this page and
              reload.
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

// Shown only inside an app's own browser (Instagram, Facebook, TikTok…), where
// most ad visitors arrive. Says what goes wrong there and offers the way out.
function InAppNotice({ browser }: { browser: InAppBrowser }) {
  const [copied, setCopied] = useState(false);
  const chromeUrl = browser.android ? openInChromeUrl(window.location.href) : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard blocked in this app: the instructions still work.
    }
  };
  return (
    <div className="w-full max-w-sm rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="font-medium">You're in {browser.app}'s browser</p>
      <p className="mt-1 text-muted-foreground">
        Google sign-in often doesn't work in here. Use your email below — we'll send you a code to type in. Or open
        this page in {browser.ios ? "Safari" : "your browser"}
        {browser.ios ? ": tap ••• at the top, then Open in browser." : "."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chromeUrl ? (
          <Button asChild size="sm">
            <a href={chromeUrl}>Open in Chrome</a>
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
