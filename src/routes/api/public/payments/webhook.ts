import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook } from "@/lib/stripe.server";
import type Stripe from "stripe";

// Reconciliation fallback: purchases are normally recorded synchronously by
// `recordSuccessfulTransaction` right after the client confirms payment (for
// instant UI feedback). But if the browser closes before that call fires,
// Kitsly never records an order at all. This webhook closes that gap by
// writing the same row (idempotent on stripe_payment_intent_id) whenever
// Stripe reports a succeeded PaymentIntent, regardless of client follow-through.
async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const productId = intent.metadata?.productId;
  if (!productId) return; // not a product-purchase intent (e.g. future subscription flows)

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent_id", intent.id)
    .maybeSingle();
  if (existing) return;

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, owner_id")
    .eq("id", productId)
    .single();
  if (!product) return;

  const buyerEmail = intent.receipt_email ?? "unknown@buyer.reconciled";

  await supabaseAdmin.from("transactions").insert({
    product_id: product.id,
    seller_id: product.owner_id,
    buyer_email: buyerEmail.toLowerCase(),
    status: "success",
    amount_paid_cents: intent.amount_received,
    stripe_payment_intent_id: intent.id,
  });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

        const rawBody = await request.text();

        let event: Stripe.Event;
        try {
          event = verifyStripeWebhook(rawBody, signature);
        } catch (error) {
          console.error("Webhook signature verification failed:", error);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "payment_intent.succeeded":
              await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
              break;
            default:
              break;
          }
          return Response.json({ received: true });
        } catch (error) {
          console.error("Webhook handling error:", error);
          return new Response("Webhook handler error", { status: 500 });
        }
      },
    },
  },
});
