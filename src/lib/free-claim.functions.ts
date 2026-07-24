import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveOptionalUserId } from "@/lib/optional-auth.server";
import { isFreeProduct } from "@/lib/checkout-math";
import { sendPurchaseConfirmationEmail } from "@/lib/email.server";
import { recordSaleSource } from "@/lib/record-source.server";

// Claiming a free product (a lead magnet) deliberately never touches Stripe.
// There is nothing to charge, so there is no PaymentIntent, no destination
// charge and — importantly — no requirement that the seller has finished
// Connect onboarding. A creator can be giving a file away in exchange for an
// email within minutes of signing up, long before they've handled any KYC.
export const claimFreeProduct = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        buyerEmail: z.string().email(),
        referrer: z.string().max(500).optional(),
        utmSource: z.string().max(100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cents, pay_what_you_want, owner_id, url_slug")
      .eq("id", data.productId)
      .single();
    if (productError || !product || !product.url_slug) {
      throw new Error("Product not found");
    }

    // Guard the money boundary from the other side: this endpoint must never be
    // usable to obtain a product that actually costs something.
    if (!isFreeProduct(product)) {
      throw new Error("This product isn't free.");
    }

    // Same rule as paid checkout — never hand over a product with nothing in it.
    const { count: fileCount } = await supabaseAdmin
      .from("product_files")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id);
    if (!fileCount) {
      throw new Error("This product isn't available yet.");
    }

    const buyerEmail = data.buyerEmail.toLowerCase();

    // There's no payment intent to deduplicate on, so re-claiming with the same
    // address returns the original record rather than inflating the seller's
    // sales count every time someone re-requests their download.
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("product_id", product.id)
      .eq("buyer_email", buyerEmail)
      .eq("amount_paid_cents", 0)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { transactionId: existing.id };
    }

    const buyerId = await resolveOptionalUserId();

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        product_id: product.id,
        seller_id: product.owner_id,
        buyer_id: buyerId,
        buyer_email: buyerEmail,
        status: "success",
        amount_paid_cents: 0,
        stripe_payment_intent_id: null,
      })
      .select("id")
      .single();
    if (insertError || !inserted) throw new Error(insertError?.message ?? "Could not record this download");

    // Best-effort: the buyer already has their download on screen, so an email
    // failure must not turn into an error they see.
    await sendPurchaseConfirmationEmail({
      buyerEmail,
      productName: product.name,
      transactionId: inserted.id,
    });

    await recordSaleSource({
      transactionId: inserted.id,
      sellerId: product.owner_id,
      referrer: data.referrer,
      utmSource: data.utmSource,
    });

    return { transactionId: inserted.id };
  });
