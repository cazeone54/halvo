import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { performRefund, buildRefundParams } from "@/lib/refund-flow";

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

    return performRefund(transaction, {
      createStripeRefund: async (paymentIntentId) => {
        try {
          await stripe.refunds.create(buildRefundParams(paymentIntentId));
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
