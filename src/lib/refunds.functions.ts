import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { performRefund, buildRefundParams } from "@/lib/refund-flow";
import { DIRECT_CHARGES } from "@/lib/plans";

export const refundTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .select("id, seller_id, status, refunded_at, stripe_payment_intent_id")
      .eq("id", data.transactionId)
      .single();
    if (error || !transaction) throw new Error("Transaction not found");
    if (transaction.seller_id !== context.userId) throw new Error("Not authorized to refund this transaction");

    const stripe = getStripeClient();

    // A direct charge lives on the seller's connected account, so the refund
    // has to be issued there — refunding on the platform account would simply
    // not find the PaymentIntent.
    let sellerAccount: string | null = null;
    if (DIRECT_CHARGES) {
      const { data: sellerProfile } = await supabaseAdmin
        .from("profiles")
        .select("stripe_connect_id")
        .eq("id", transaction.seller_id)
        .single();
      sellerAccount = sellerProfile?.stripe_connect_id ?? null;
      if (!sellerAccount) {
        throw new Error("This seller has no connected Stripe account, so the charge can't be refunded.");
      }
    }

    return performRefund(transaction, {
      createStripeRefund: async (paymentIntentId) => {
        try {
          await stripe.refunds.create(
            buildRefundParams(paymentIntentId),
            sellerAccount ? { stripeAccount: sellerAccount } : undefined,
          );
        } catch (stripeError) {
          throw new Error(getStripeErrorMessage(stripeError));
        }
      },
      markTransactionRefunded: async (transactionId) => {
        const { error: updateError } = await supabaseAdmin
          .from("transactions")
          .update({ status: "refunded", refunded_at: new Date().toISOString() })
          .eq("id", transactionId);
        if (updateError) throw new Error(updateError.message);
      },
    });
  });
