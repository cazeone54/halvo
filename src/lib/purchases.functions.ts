import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyPurchase = {
  transactionId: string;
  productName: string;
  productSlug: string | null;
  amountPaidCents: number;
  createdAt: string;
  refunded: boolean;
  disputed: boolean;
  hasLicenseKey: boolean;
};

// A signed-in buyer's own library: everything they've purchased, so they never
// have to dig through email to re-download or find a license key. Reads with
// the service role but is STRICTLY scoped to the caller's own identity — their
// user id and the verified email on their JWT — so it can only ever return the
// caller's own purchases. buyer_id catches purchases made while signed in;
// buyer_email also catches guest purchases they made before creating an account
// (buyer_email is always stored lowercased). Degrade-safe: any failure yields an
// empty library rather than an error page.
export const listMyPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPurchase[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const email = (context.claims.email as string | undefined)?.toLowerCase();

      const columns = "id, product_id, amount_paid_cents, status, created_at, refunded_at, disputed_at, products(name, url_slug)";

      // Two scoped reads (by id, by email) merged and de-duped — clearer and
      // safer than a PostgREST .or() with an email value that could contain
      // filter-syntax characters.
      const byId = await supabaseAdmin
        .from("transactions")
        .select(columns)
        .eq("buyer_id", context.userId)
        .eq("status", "success");

      const byEmail = email
        ? await supabaseAdmin.from("transactions").select(columns).eq("buyer_email", email).eq("status", "success")
        : { data: [] as NonNullable<typeof byId.data> };

      const merged = new Map<string, NonNullable<typeof byId.data>[number]>();
      for (const row of [...(byId.data ?? []), ...(byEmail.data ?? [])]) merged.set(row.id, row);
      const rows = [...merged.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      // Which of these purchases carry a license key (feature is opt-in and the
      // table may not be migrated yet) — best-effort so it never breaks the list.
      const licensed = new Set<string>();
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        try {
          const { data: keys } = await supabaseAdmin
            .from("license_keys")
            .select("transaction_id")
            .in("transaction_id", ids);
          for (const k of keys ?? []) licensed.add(k.transaction_id);
        } catch {
          // license_keys not migrated — no badges, list still renders.
        }
      }

      return rows.map((r) => ({
        transactionId: r.id,
        productName: (r.products as unknown as { name: string } | null)?.name ?? "Product",
        productSlug: (r.products as unknown as { url_slug: string | null } | null)?.url_slug ?? null,
        amountPaidCents: r.amount_paid_cents,
        createdAt: r.created_at,
        refunded: r.refunded_at != null,
        disputed: r.disputed_at != null,
        hasLicenseKey: licensed.has(r.id),
      }));
    } catch {
      return [];
    }
  });
