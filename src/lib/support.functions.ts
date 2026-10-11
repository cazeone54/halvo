import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BRAND_EMAIL } from "@/lib/site";

// Public — for the download page: who to contact about a faulty, missing or
// misdescribed file (the one case the refund policy covers). The seller's
// support email is already public on their product page; Halvo's address is
// the fallback when they haven't set one.
export const getSupportContactForTransaction = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("seller_id")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) return null;
    const { data: seller } = tx.seller_id
      ? await supabaseAdmin.from("profiles").select("support_email, display_name, handle").eq("id", tx.seller_id).maybeSingle()
      : { data: null };
    const sellerEmail = seller?.support_email?.trim() || null;
    return {
      email: sellerEmail ?? BRAND_EMAIL,
      isSeller: !!sellerEmail,
      sellerName: seller?.display_name || seller?.handle || null,
    };
  });
