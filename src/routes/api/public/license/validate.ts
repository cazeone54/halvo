import { createFileRoute } from "@tanstack/react-router";
import { looksLikeLicenseKey } from "@/lib/license";

// Public license-validation API for a seller's own software to call:
//
//   GET /api/public/license/validate?key=AB3K-9XZ2-QW7M-4TYP
//   -> { "valid": true, "product": "Focus — Notion OS" }
//
// A key is valid only while its purchase is a completed, non-refunded,
// non-disputed sale — so refunds and chargebacks auto-revoke it with no extra
// bookkeeping. No secrets are involved and only a boolean + product name are
// returned, so it's CORS-open for use from anywhere the seller's app runs.
const CORS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
} as const;

export const Route = createFileRoute("/api/public/license/validate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" },
        }),
      GET: async ({ request }) => {
        try {
          const key = (new URL(request.url).searchParams.get("key") ?? "").trim().toUpperCase();
          if (!looksLikeLicenseKey(key)) {
            return new Response(JSON.stringify({ valid: false }), { headers: CORS });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: lk } = await supabaseAdmin
            .from("license_keys")
            .select("transaction_id, product_id")
            .eq("license_key", key)
            .maybeSingle();
          if (!lk) return new Response(JSON.stringify({ valid: false }), { headers: CORS });

          const { data: txn } = await supabaseAdmin
            .from("transactions")
            .select("status, refunded_at, disputed_at")
            .eq("id", lk.transaction_id)
            .single();
          const valid = !!txn && txn.status === "success" && !txn.refunded_at && !txn.disputed_at;

          let product: string | null = null;
          if (lk.product_id) {
            const { data: p } = await supabaseAdmin.from("products").select("name").eq("id", lk.product_id).single();
            product = p?.name ?? null;
          }

          return new Response(JSON.stringify({ valid, product }), { headers: CORS });
        } catch {
          // Never leak internals; an error is just "not valid" to the caller.
          return new Response(JSON.stringify({ valid: false }), { headers: CORS });
        }
      },
    },
  },
});
