import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMySales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, buyer_email, amount_paid_cents, status, created_at, terms_acked_at, disputed_at, products(name)")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];

    // Fold in the download evidence trail (0006) so the seller can see, per
    // sale, that the buyer agreed to final-sale terms and actually accessed
    // the file — the two things that defend a chargeback.
    const downloads = new Map<string, { count: number; lastAt: string | null }>();
    const txIds = rows.map((t) => t.id);
    if (txIds.length > 0) {
      const { data: events } = await context.supabase
        .from("download_events")
        .select("transaction_id, created_at")
        .in("transaction_id", txIds);
      for (const e of events ?? []) {
        const cur = downloads.get(e.transaction_id) ?? { count: 0, lastAt: null };
        cur.count += 1;
        if (!cur.lastAt || e.created_at > cur.lastAt) cur.lastAt = e.created_at;
        downloads.set(e.transaction_id, cur);
      }
    }

    // Affiliate commissions withheld from these sales. Read with the service
    // role, scoped to transaction ids we've already confirmed belong to this
    // seller — the commissions RLS policy only exposes rows to the *referrer*,
    // not to the seller whose sale funded them.
    const affiliateFees = new Map<string, number>();
    const licenseKeys = new Map<string, string>();
    if (txIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: commissions } = await supabaseAdmin
        .from("commissions")
        .select("transaction_id, amount_cents")
        .in("transaction_id", txIds);
      for (const c of commissions ?? []) {
        affiliateFees.set(c.transaction_id, (affiliateFees.get(c.transaction_id) ?? 0) + c.amount_cents);
      }

      // The issued license key per sale, so the seller can look it up when a
      // buyer asks for support. Best-effort: the table is service-role-only and
      // may be unmigrated, so any failure just means no key shown on the row.
      try {
        const { data: keys } = await supabaseAdmin
          .from("license_keys")
          .select("transaction_id, license_key")
          .in("transaction_id", txIds);
        for (const k of keys ?? []) licenseKeys.set(k.transaction_id, k.license_key);
      } catch {
        // license_keys not migrated — sales still render, just without keys.
      }
    }

    return rows.map((t) => ({
      id: t.id,
      buyerEmail: t.buyer_email,
      amountPaidCents: t.amount_paid_cents,
      status: t.status,
      createdAt: t.created_at,
      productName: (t.products as unknown as { name: string } | null)?.name ?? "Unknown product",
      termsAcked: t.terms_acked_at != null,
      disputed: t.disputed_at != null,
      affiliateFeeCents: affiliateFees.get(t.id) ?? 0,
      downloadCount: downloads.get(t.id)?.count ?? 0,
      lastDownloadAt: downloads.get(t.id)?.lastAt ?? null,
      licenseKey: licenseKeys.get(t.id) ?? null,
    }));
  });
