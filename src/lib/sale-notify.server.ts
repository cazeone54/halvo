import { sendSaleNotificationEmail } from "@/lib/email.server";
import type { Currency } from "@/lib/currency";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

// Email the seller that they earned money. Called by whichever writer records
// the sale first — the buyer's browser (recordSuccessfulTransaction) or the
// Stripe webhook — so the seller hears about every sale, not only the ones the
// browser happened to record. Best-effort throughout: a missing seller, an
// unreachable auth lookup or an email failure must never break the recording
// of a purchase the buyer has already paid for.
export async function notifySellerOfSale(args: {
  supabaseAdmin: Admin;
  sellerId: string | null;
  productName: string;
  amountCents: number;
  currency?: Currency;
}): Promise<void> {
  if (!args.sellerId) return;
  try {
    // Their very first sale gets different copy — this row is already written,
    // so a count of exactly 1 means this is it.
    const { count } = await args.supabaseAdmin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", args.sellerId)
      .eq("status", "success");

    const { data: sellerUser } = await args.supabaseAdmin.auth.admin.getUserById(args.sellerId);
    const sellerEmail = sellerUser?.user?.email;
    if (!sellerEmail) return;

    await sendSaleNotificationEmail({
      sellerEmail,
      productName: args.productName,
      amountCents: args.amountCents,
      currency: args.currency,
      isFirstSale: count === 1,
    });
  } catch (error) {
    console.error("Seller sale notification failed:", error);
  }
}
