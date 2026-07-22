import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS, tierFromPriceId, type PlanTier } from "@/lib/plans";
import type { Database } from "@/integrations/supabase/types";

const PAST_DUE_GRACE_DAYS = 7;

// The single place tier is computed from — see plans.ts and
// supabase/migrations/0002_subscriptions.sql for why there's only one.
export async function resolveUserTier(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PlanTier> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return "free";

  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const now = new Date();

  if (sub.status === "active" || sub.status === "trialing") {
    return tierFromPriceId(sub.price_id);
  }

  if (sub.status === "past_due" && periodEnd) {
    const graceEnd = new Date(periodEnd.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    if (now < graceEnd) return tierFromPriceId(sub.price_id);
  }

  if (sub.status === "canceled" && periodEnd && now < periodEnd) {
    return tierFromPriceId(sub.price_id);
  }

  return "free";
}

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tier = await resolveUserTier(context.supabase, context.userId);
    return { tier, limits: PLAN_LIMITS[tier] };
  });

// Coupons and the affiliate program are Creator/Pro perks — Free sellers
// can't run discounts or recruit affiliates, matching Kitsly's own gating.
export async function requireCreatorTier(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const tier = await resolveUserTier(supabase, userId);
  if (tier === "free") {
    throw new Error("This feature requires the Creator or Pro plan.");
  }
}
