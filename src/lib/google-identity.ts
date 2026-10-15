// Google Identity Services — the ID-token sign-in flow.
//
// WHY THIS EXISTS, AND IT IS NOT ABOUT FEATURES
// ---------------------------------------------------------------------------
// supabase.auth.signInWithOAuth sends the visitor to Google with
// redirect_uri = https://<project-ref>.supabase.co/auth/v1/callback, and Google
// renders its consent screen against that host:
//
//     app_domain = https://nqnqwfodnievsrzgcvem.supabase.co
//
// So the screen reads "to continue to nqnqwfodnievsrzgcvem.supabase.co", which
// looks like a phishing page to anyone paying attention. Moving that to
// auth.halvo.io needs Supabase's Custom Domain add-on, i.e. the Pro plan.
//
// This flow avoids it for free. Google issues the ID token in the page itself,
// so the popup is anchored to halvo.io and the Supabase host never appears. The
// token then goes to signInWithIdToken, which verifies it against Google's
// public keys server-side — same security, no redirect.
//
// REQUIRES, in Google Cloud Console > Credentials > the OAuth client:
//   Authorized JavaScript origins:  https://halvo.io
//                                   http://localhost:8080  (for dev)
// and the SAME client id must stay configured on Supabase's Google provider,
// because that's what Supabase checks the token's audience against.
//
// Inert unless VITE_GOOGLE_CLIENT_ID is set, so the redirect flow keeps working
// until the origins above are actually added.

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || null;

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

// hl=en pins the language of everything Google renders (the button iframe and
// the popup). renderButton's own `locale` option alone was ignored in testing:
// a Bulgarian-locale browser still got a Bulgarian button in an English card.
const SCRIPT_SRC = "https://accounts.google.com/gsi/client?hl=en";

let scriptPromise: Promise<void> | null = null;

/** Load the GIS script once, however many times this is called. */
export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in failed to load")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error("Google sign-in failed to load"));
    };
    document.head.appendChild(s);
  });

  return scriptPromise;
}

/** Lowercase hex of a byte array. Separate so it can be tested on its own. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * A nonce pair for the flow.
 *
 * Google is given the HASHED value and embeds it in the token it issues;
 * Supabase is given the RAW value and hashes it to check they match. Sending
 * the same value to both would defeat the point, so the two are returned
 * together and deliberately named.
 */
export async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url-ish: only needs to survive a JWT claim and a round trip.
  const raw = toHex(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return { raw, hashed: toHex(new Uint8Array(digest)) };
}
