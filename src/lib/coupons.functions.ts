import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorTier } from "@/lib/user-plan.functions";
import { applyCouponDiscount, type CouponDiscount } from "@/lib/coupon-math";

export const listMyCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("coupons")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        code: z.string().trim().min(3).max(32),
        productId: z.string().uuid().optional(),
        percentOff: z.number().int().min(1).max(100).optional(),
        amountOffCents: z.number().int().min(1).optional(),
        maxRedemptions: z.number().int().min(1).optional(),
        expiresAt: z.string().datetime().optional(),
      })
      .refine((d) => (d.percentOff != null) !== (d.amountOffCents != null), {
        message: "Specify exactly one of percentOff or amountOffCents",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCreatorTier(context.supabase, context.userId);

    const { error } = await context.supabase.from("coupons").insert({
      owner_id: context.userId,
      product_id: data.productId ?? null,
      code: data.code.toUpperCase(),
      percent_off: data.percentOff ?? null,
      amount_off_cents: data.amountOffCents ?? null,
      max_redemptions: data.maxRedemptions ?? null,
      expires_at: data.expiresAt ?? null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already have a coupon with that code.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const setCouponActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ couponId: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("coupons")
      .update({ active: data.active })
      .eq("id", data.couponId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ couponId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("coupons")
      .delete()
      .eq("id", data.couponId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Server-only helper (not a public RPC) — the checkout flow already runs
// entirely through the service-role client, so validation is just a direct,
// owner-scoped query rather than a separate Postgres function.
export async function findValidCoupon(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  code: string,
  productId: string,
): Promise<CouponDiscount | null> {
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("owner_id")
    .eq("id", productId)
    .single();
  if (!product?.owner_id) return null;

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("id, percent_off, amount_off_cents, product_id, active, expires_at, max_redemptions, redemptions")
    .eq("code", code.toUpperCase())
    .eq("owner_id", product.owner_id)
    .single();
  if (!coupon || !coupon.active) return null;
  if (coupon.product_id && coupon.product_id !== productId) return null;
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) return null;
  if (coupon.max_redemptions != null && coupon.redemptions >= coupon.max_redemptions) return null;

  return { percent_off: coupon.percent_off, amount_off_cents: coupon.amount_off_cents };
}

// Public — lets the checkout UI preview the discounted price before paying.
export const applyCouponPreview = createServerFn({ method: "POST" })
  .validator((data) => z.object({ code: z.string().min(1), productId: z.string().uuid(), amountCents: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const coupon = await findValidCoupon(supabaseAdmin, data.code, data.productId);
    if (!coupon) throw new Error("Invalid or expired coupon code.");
    return { discountedAmountCents: applyCouponDiscount(data.amountCents, coupon) };
  });
