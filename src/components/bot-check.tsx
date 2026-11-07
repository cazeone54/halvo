import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile in front of sign-up, so a script can't create accounts
// in bulk (30 arrived in two five-minute bursts on 6 Nov 2026).
//
// Supabase checks the token itself: with CAPTCHA switched on under
// Authentication > Attack Protection, every email-code and Google sign-in must
// carry one. So the ORDER of switching it on matters:
//   1. set VITE_TURNSTILE_SITE_KEY here and deploy — tokens start being sent
//      (Supabase ignores them while its own CAPTCHA setting is off);
//   2. only then turn CAPTCHA on in Supabase with the secret key.
// The other way round, nobody can sign in until step 1 lands.
//
// Renders nothing at all when the key is unset.
//
// "interaction-only": almost everyone never sees it; a box appears only when
// Cloudflare wants a human to tick it.

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || null;
export const BOT_CHECK_ON = !!SITE_KEY;

type TurnstileApi = {
  render(
    el: HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "compact";
      theme?: "auto" | "light" | "dark";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // let a later visit retry
      reject(new Error("Security check failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type BotCheckHandle = {
  /** The current token, or null while the check is still running. */
  token: () => string | null;
  /** Tokens are single-use: call after every sign-in attempt. */
  reset: () => void;
};

export const BotCheck = forwardRef<BotCheckHandle, { onBlocked?: () => void }>(function BotCheck({ onBlocked }, ref) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  useImperativeHandle(
    ref,
    () => ({
      token: () => token.current,
      reset: () => {
        token.current = null;
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!SITE_KEY || !holder.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          theme: "auto",
          callback: (t) => {
            token.current = t;
          },
          // Turnstile refreshes an expired token by itself; until it does,
          // there's no valid one to send.
          "expired-callback": () => {
            token.current = null;
          },
          "error-callback": () => {
            token.current = null;
          },
        });
      })
      .catch(() => {
        // Blocked by an extension or a network filter: sign-in would fail at
        // Supabase with a vague message, so the page says what to do instead.
        if (!cancelled) onBlockedRef.current?.();
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="flex justify-center empty:hidden" />;
});
