import { getRequest } from "@tanstack/react-start/server";

// Whoever is sending this, as well as we can tell behind Railway's proxy. Only
// ever used as a rate-limit key. Null when the proxy tells us nothing: one
// shared "unknown" bucket would mean the eleventh person in an hour is turned
// away because of the ten before them, which is worse than not limiting by
// sender at all.
export function senderKey(): string | null {
  try {
    const { headers } = getRequest();
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || headers.get("x-real-ip") || null;
  } catch {
    return null;
  }
}
