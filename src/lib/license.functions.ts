import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateLicenseKey } from "@/lib/license";

// Public: mints (once) and returns the license key for a completed purchase, if
// the product opts in. Called by the buyer's download page — NOT the money
// path. Idempotent via the unique(transaction_id) constraint, and best-effort
// throughout so it can never break the download page; with no migration 0016 it
// simply returns null (the feature stays dormant).
export const getLicenseKeyForTransaction = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ licenseKey: string | null }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Only a real, still-valid purchase gets a key.
      const { data: txn } = await supabaseAdmin
        .from("transactions")
        .select("id, product_id, status, refunded_at, disputed_at")
        .eq("id", data.transactionId)
        .single();
      if (!txn || txn.status !== "success" || txn.refunded_at || txn.disputed_at) {
        return { licenseKey: null };
      }

      // Opt-in per product. Missing column (unmigrated) → data null → dormant.
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("license_key_enabled")
        .eq("id", txn.product_id)
        .single();
      if (!product?.license_key_enabled) return { licenseKey: null };

      // Idempotent: return the existing key, or mint one.
      const { data: existing } = await supabaseAdmin
        .from("license_keys")
        .select("license_key")
        .eq("transaction_id", txn.id)
        .maybeSingle();
      if (existing?.license_key) return { licenseKey: existing.license_key };

      const { data: inserted } = await supabaseAdmin
        .from("license_keys")
        .insert({ transaction_id: txn.id, product_id: txn.product_id, license_key: generateLicenseKey() })
        .select("license_key")
        .single();
      if (inserted?.license_key) return { licenseKey: inserted.license_key };

      // The insert lost a race (a concurrent request minted first) — read the winner.
      const { data: after } = await supabaseAdmin
        .from("license_keys")
        .select("license_key")
        .eq("transaction_id", txn.id)
        .maybeSingle();
      return { licenseKey: after?.license_key ?? null };
    } catch {
      return { licenseKey: null };
    }
  });
