import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_CLIENT_ID, createNoncePair, loadGoogleIdentity } from "@/lib/google-identity";

/**
 * Google's own sign-in button, using the ID-token flow so the consent popup is
 * anchored to this site rather than to the Supabase project host. See
 * @/lib/google-identity for why that matters.
 *
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is unset — the caller then falls
 * back to the ordinary redirect button, so an unconfigured deploy still has a
 * working Google sign-in.
 *
 * `onUnavailable` fires if the script can't load (blocked by an extension or an
 * offline network), so the caller can show the redirect button instead rather
 * than leaving a gap where the button should be.
 */
export function GoogleSignInButton({ onUnavailable }: { onUnavailable?: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !holder.current) return;
    let cancelled = false;

    (async () => {
      try {
        const [{ raw, hashed }] = await Promise.all([createNoncePair(), loadGoogleIdentity()]);
        if (cancelled || !holder.current) return;

        const id = window.google?.accounts?.id;
        if (!id) throw new Error("Google sign-in unavailable");

        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          // No automatic prompt: a sign-in sheet appearing unasked on a
          // marketplace's landing flow is hostile, and it can't be dismissed
          // meaningfully by someone who only wanted to browse.
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response) => {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: raw,
            });
            if (error) setError(error.message);
            else navigate({ to: "/dashboard" });
          },
        });

        id.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 320,
          // Google localises its button to the browser by default, which put
          // a Bulgarian button inside an otherwise English card. The site is
          // English throughout, so the button should be too.
          locale: "en",
        });
      } catch (e) {
        if (!cancelled) onUnavailable?.();
        void e;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, onUnavailable]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Google renders its button inside this element, about half a second
          after the page loads. The height it will take is reserved from the
          first paint: without it the card grew by 40px on arrival, and since
          the page centres the card vertically, the whole thing jumped —
          under the cursor of anyone already typing their email.
          Centred because its fixed width won't always match the card. */}
      <div ref={holder} className="flex min-h-10 justify-center [color-scheme:light]" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
