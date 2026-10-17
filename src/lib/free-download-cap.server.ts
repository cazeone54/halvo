import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FREE_DOWNLOAD_BLOCKED_MESSAGE, isOverFreeDownloadCap } from "@/lib/free-download-cap";

type Admin = SupabaseClient<Database>;

export function monthStartIso(now = new Date()): string {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

// Bytes this seller has served from FREE products since the 1st. Degrade-safe:
// if the read fails or migration 0027 isn't applied, it reports 0, which keeps
// deliveries working rather than blocking them on a bookkeeping problem.
export async function freeBytesServedThisMonth(admin: Admin, sellerId: string | null): Promise<number> {
  if (!sellerId) return 0;
  try {
    const { data, error } = await admin
      .from("download_events")
      .select("bytes")
      .eq("seller_id", sellerId)
      .eq("is_free", true)
      .gte("created_at", monthStartIso());
    if (error) return 0;
    return (data ?? []).reduce((sum, e) => sum + (e.bytes ?? 0), 0);
  } catch {
    return 0;
  }
}

// Throws when a free product has been given away past this month's cap. Only
// ever called for a free delivery — a paid one is never blocked.
export async function assertFreeDownloadAllowed(admin: Admin, sellerId: string | null): Promise<void> {
  if (isOverFreeDownloadCap(await freeBytesServedThisMonth(admin, sellerId))) {
    throw new Error(FREE_DOWNLOAD_BLOCKED_MESSAGE);
  }
}
