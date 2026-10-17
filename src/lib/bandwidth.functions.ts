import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { PLAN_LIMITS } from "@/lib/plans";
import { computeBandwidthStatus } from "@/lib/bandwidth-usage";
import { FREE_DOWNLOAD_GB_PER_MONTH, isOverFreeDownloadCap } from "@/lib/free-download-cap";
import { freeBytesServedThisMonth } from "@/lib/free-download-cap.server";

// A seller's download bandwidth used so far this calendar month, against their
// plan's soft limit. Read straight from the denormalized seller_id/bytes on
// download_events (indexed), so it stays a single cheap query.
export const getMyBandwidthUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: events, error } = await supabaseAdmin
      .from("download_events")
      .select("bytes")
      .eq("seller_id", context.userId)
      .gte("created_at", monthStart.toISOString());
    if (error) throw new Error(error.message);

    const usedBytes = (events ?? []).reduce((sum, e) => sum + (e.bytes ?? 0), 0);
    const tier = await resolveUserTier(supabaseAdmin, context.userId);

    // Free products are capped separately and for real (free-download-cap.ts),
    // so the seller is shown where they stand before deliveries stop rather
    // than after.
    const freeUsedBytes = await freeBytesServedThisMonth(supabaseAdmin, context.userId);
    const free = computeBandwidthStatus(freeUsedBytes, FREE_DOWNLOAD_GB_PER_MONTH);

    return {
      ...computeBandwidthStatus(usedBytes, PLAN_LIMITS[tier].monthlyBandwidthGb),
      tier,
      free: { ...free, blocked: isOverFreeDownloadCap(freeUsedBytes) },
    };
  });
