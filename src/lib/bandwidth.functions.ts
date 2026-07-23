import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { PLAN_LIMITS } from "@/lib/plans";
import { computeBandwidthStatus } from "@/lib/bandwidth-usage";

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
    return { ...computeBandwidthStatus(usedBytes, PLAN_LIMITS[tier].monthlyBandwidthGb), tier };
  });
