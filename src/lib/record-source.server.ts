import { normalizeTrafficSource } from "@/lib/traffic-source";
import { BASE_URL } from "@/lib/site";

// Records where a sale came from. Entirely best-effort and always called AFTER
// the transaction is safely written: analytics are never worth risking a
// purchase the buyer has already paid for, and this also means the feature
// degrades quietly if migration 0009 hasn't been applied yet.
export async function recordSaleSource(args: {
  transactionId: string;
  sellerId: string | null;
  referrer?: string | null;
  utmSource?: string | null;
}): Promise<void> {
  try {
    const selfHost = (() => {
      try {
        return new URL(BASE_URL).hostname;
      } catch {
        return null;
      }
    })();

    const source = normalizeTrafficSource({
      referrer: args.referrer,
      utmSource: args.utmSource,
      selfHost,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sale_sources")
      .insert({ transaction_id: args.transactionId, seller_id: args.sellerId, source });

    // 23505 = already recorded for this sale (a retry); anything else is worth
    // knowing about but still must not surface to the buyer.
    if (error && error.code !== "23505") {
      console.error("Sale source record failed:", error.message);
    }
  } catch (error) {
    console.error("Sale source record threw:", error);
  }
}
