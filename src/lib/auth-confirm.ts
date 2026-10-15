// Rules for /auth/confirm — the page a sign-in or confirmation email links to.
//
// The emails used to link to Supabase's own /auth/v1/verify on
// <project-ref>.supabase.co: a domain the recipient has never seen, inside an
// email from halvo.io. That reads as phishing to people and to spam filters
// (a link domain that doesn't match the sender is a classic spam signal). The
// templates now link here with a token hash, and this page completes the
// sign-in with supabase.auth.verifyOtp — so nothing in the email points
// anywhere but halvo.io.

import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES: readonly EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

export function parseOtpType(raw: unknown): EmailOtpType | null {
  return typeof raw === "string" && (OTP_TYPES as readonly string[]).includes(raw) ? (raw as EmailOtpType) : null;
}

/**
 * Where to send someone after they're signed in.
 *
 * Only a same-site path is accepted. `next` arrives in a URL anyone can craft,
 * so honouring an absolute or protocol-relative URL here would turn a genuine
 * halvo.io sign-in link into a redirect to an attacker's page — exactly the
 * kind of open redirect phishing kits look for.
 */
export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500) return fallback;
  if (!raw.startsWith("/")) return fallback; // absolute URLs, javascript:, etc.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback; // protocol-relative
  if (/[\r\n\t]/.test(raw)) return fallback;
  return raw;
}
