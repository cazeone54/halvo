import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isRateLimited } from "@/lib/rate-limit";
import { sendPurchaseAccessEmail } from "@/lib/email.server";

// "I lost my download email." A buyer enters their address and we email them the
// links to everything they've bought — proving ownership via control of the
// inbox, the same way the original receipt did.
//
// Security: this is public, so it is deliberately ENUMERATION-SAFE. It always
// returns { ok: true } and never reveals whether the email matched any
// purchases — so it can't be used to probe who bought what. It's rate-limited
// per email so it can't be used to spam-bomb an address, and everything is
// best-effort/try-caught so a failure can't leak state through an error.
export const requestPurchaseAccess = createServerFn({ method: "POST" })
  .validator((data) => z.object({ email: z.string().trim().toLowerCase().email() }).parse(data))
  .handler(async ({ data }) => {
    const email = data.email;

    // Cap re-send requests per address (3 per 10 min) — prevents using this to
    // flood someone's inbox. Rate-limited requests still return ok, revealing
    // nothing.
    if (isRateLimited(`purchase-access:${email}`, 3, 10 * 60 * 1000)) {
      return { ok: true } as const;
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("transactions")
        .select("id, products(name)")
        .eq("buyer_email", email)
        .eq("status", "success")
        .is("refunded_at", null)
        .is("disputed_at", null)
        .order("created_at", { ascending: false });

      const purchases = (rows ?? []).map((r) => ({
        transactionId: r.id,
        productName: (r.products as unknown as { name: string } | null)?.name ?? "Your purchase",
      }));

      if (purchases.length > 0) {
        await sendPurchaseAccessEmail({ email, purchases });
      }
    } catch {
      // Never surface an error — that itself would leak whether something matched.
    }

    return { ok: true } as const;
  });
