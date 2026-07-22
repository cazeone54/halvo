import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorTier } from "@/lib/user-plan.functions";
import { calcCommissionCents, COMMISSION_PERCENT } from "@/lib/commission-math";
import type { Database } from "@/integrations/supabase/types";

export { COMMISSION_PERCENT };

// Excludes visually ambiguous characters (0/O, 1/I/l).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export const ensurePlatformCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCreatorTier(context.supabase, context.userId);

    const { data: existing } = await context.supabase
      .from("referral_codes")
      .select("id, code")
      .eq("user_id", context.userId)
      .eq("kind", "platform")
      .maybeSingle();
    if (existing) return existing;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data, error } = await context.supabase
        .from("referral_codes")
        .insert({ user_id: context.userId, code, kind: "platform" })
        .select("id, code")
        .single();
      if (!error) return data;
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Could not generate a unique referral code — try again.");
  });

export const createProductCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireCreatorTier(context.supabase, context.userId);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data: row, error } = await context.supabase
        .from("referral_codes")
        .insert({ user_id: context.userId, code, kind: "product", product_id: data.productId })
        .select("id, code")
        .single();
      if (!error) return row;
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Could not generate a unique referral code — try again.");
  });

export const getMyReferralData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: codes, error } = await context.supabase
      .from("referral_codes")
      .select("id, code, kind, product_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const { data: products } = await context.supabase
      .from("products")
      .select("id, name, url_slug")
      .eq("owner_id", context.userId)
      .not("url_slug", "is", null);

    return { codes: codes ?? [], products: products ?? [] };
  });

export const getMyCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("commissions")
      .select("id, amount_cents, status, kind, created_at")
      .eq("referrer_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const totalCents = (rows ?? []).reduce((sum, r) => sum + r.amount_cents, 0);
    const pendingCents = (rows ?? [])
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + r.amount_cents, 0);

    return { rows: rows ?? [], totalCents, pendingCents };
  });

// --- Server-only helpers used by checkout.functions.ts ---

export async function resolveReferralCode(
  supabaseAdmin: SupabaseClient<Database>,
  code: string,
  productId: string,
): Promise<{ id: string; userId: string; kind: "platform" | "product" } | null> {
  const { data } = await supabaseAdmin
    .from("referral_codes")
    .select("id, user_id, kind, product_id")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!data) return null;
  if (data.kind === "product" && data.product_id !== productId) return null;
  return { id: data.id, userId: data.user_id, kind: data.kind };
}

export async function insertCommissionForTransaction(
  supabaseAdmin: SupabaseClient<Database>,
  params: {
    referralCodeId: string;
    referrerUserId: string;
    transactionId: string;
    kind: "platform" | "product";
    amountPaidCents: number;
  },
): Promise<void> {
  await supabaseAdmin.from("commissions").insert({
    referral_code_id: params.referralCodeId,
    referrer_user_id: params.referrerUserId,
    transaction_id: params.transactionId,
    kind: params.kind,
    amount_cents: calcCommissionCents(params.amountPaidCents),
  });
}
