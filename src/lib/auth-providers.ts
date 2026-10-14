// Which social sign-in buttons the auth page offers.
//
// Driven by VITE_AUTH_PROVIDERS so adding a provider is a dashboard job plus an
// env var, not a code change: the hard part of a new provider is always the
// OAuth app on the provider's side, and that can't be done from here.
//
//   VITE_AUTH_PROVIDERS="google,apple,facebook"
//
// Order in the variable is the order of the buttons, so the one most of your
// visitors actually use can go first.
//
// A provider listed here but NOT enabled in Supabase renders a button that
// fails on click, so the two have to be kept in step — which is why unknown
// names are dropped rather than guessed at, and why the default is just google.

export type AuthProviderId =
  | "google"
  | "apple"
  | "facebook"
  | "github"
  | "linkedin_oidc"
  | "azure"
  | "discord"
  | "x";

export interface AuthProviderDef {
  /** Exactly what supabase.auth.signInWithOAuth expects. */
  id: AuthProviderId;
  /** Shown on the button, after "Continue with". */
  name: string;
}

// Curated rather than exhaustive: Supabase offers ~25 providers, and a wall of
// buttons measurably reduces sign-ups. These are the ones that fit who buys and
// sells here — creators, business coaches, and the developers who buy the
// technical products.
export const AUTH_PROVIDERS: readonly AuthProviderDef[] = [
  { id: "google", name: "Google" },
  { id: "apple", name: "Apple" },
  { id: "facebook", name: "Facebook" },
  { id: "github", name: "GitHub" },
  { id: "linkedin_oidc", name: "LinkedIn" },
  { id: "azure", name: "Microsoft" },
  { id: "discord", name: "Discord" },
  { id: "x", name: "X" },
] as const;

const BY_ID = new Map(AUTH_PROVIDERS.map((p) => [p.id, p]));

// Names people will plausibly type in the env var instead of the real id.
const ALIASES: Record<string, AuthProviderId> = {
  linkedin: "linkedin_oidc",
  microsoft: "azure",
  twitter: "x",
  meta: "facebook",
};

/**
 * Parse VITE_AUTH_PROVIDERS into the buttons to render.
 *
 * Unset or empty yields just Google, which is what the page offered before this
 * existed — so a deploy that forgets the variable keeps working rather than
 * losing every sign-in button.
 */
export function parseEnabledProviders(raw: string | undefined | null): AuthProviderDef[] {
  const names = (raw ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0) return [BY_ID.get("google")!];

  const seen = new Set<AuthProviderId>();
  const out: AuthProviderDef[] = [];
  for (const name of names) {
    const id = BY_ID.has(name as AuthProviderId) ? (name as AuthProviderId) : ALIASES[name];
    // An unrecognised name is dropped on purpose: rendering a button for it
    // would give a visitor a sign-in path that cannot work.
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(BY_ID.get(id)!);
  }

  // Everything was junk — fall back rather than render an auth page with no
  // social buttons at all.
  return out.length > 0 ? out : [BY_ID.get("google")!];
}
