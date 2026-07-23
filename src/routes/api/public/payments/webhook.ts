import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, getStripeClient } from "@/lib/stripe.server";
import { sendPurchaseConfirmationEmail } from "@/lib/email.server";
import { decideDisputeClose } from "@/lib/dispute-liability";
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
    .select("id, name, owner_id")
    .eq("id", productId)
    .single();
  if (!product) return;

  const buyerEmail = intent.receipt_email ?? "unknown@buyer.reconciled";
  const couponCode = (intent.metadata?.coupon_code as string | undefined) ?? null;

  // Note: this fallback can't know the buyer's signed-in user id or any
  // referral code — those only ever reach the server via the client-driven
  // recordSuccessfulTransaction call (checkout.functions.ts), which also
  // backfills coupon_code/buyer_id here and creates referral commissions if
  // it runs after this insert wins the race. Preserving coupon_code here too
  // just avoids losing it entirely in the rare case the client never calls
  // back at all (e.g. the browser closed immediately after payment).
  const { data: inserted } = await supabaseAdmin
    .from("transactions")
    .insert({
      product_id: product.id,
      seller_id: product.owner_id,
      buyer_email: buyerEmail.toLowerCase(),
      status: "success",
      amount_paid_cents: intent.amount_received,
      stripe_payment_intent_id: intent.id,
      coupon_code: couponCode,
    })
    .select("id")
    .single();

  // Same "whoever inserted fresh sends the email" rule as
  // recordSuccessfulTransaction — this only fires when this webhook path is
  // the one that actually created the row (the `if (existing) return;` above
  // already excludes the case where the client beat it to the insert).
  if (inserted) {
    await sendPurchaseConfirmationEmail({
      buyerEmail: buyerEmail.toLowerCase(),
      productName: product.name,
      transactionId: inserted.id,
    });
  }
}

// Resolve the transaction id + its Payment Intent id from a dispute.
async function findDisputedTransaction(dispute: Stripe.Dispute) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const paymentIntentId =
    typeof dispute.payment_intent === "string" ? dispute.payment_intent : (dispute.payment_intent?.id ?? null);
  if (!paymentIntentId) return null;
  const { data } = await supabaseAdmin
    .from("transactions")
    .select("id, seller_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  return data;
}

// A dispute opened. Record it (idempotent on the Stripe dispute id) and flag
// the purchase as under dispute — that revokes the buyer's download access and
// surfaces it on the seller's dashboard. No money moves yet; the seller is only
// charged for a dispute they actually lose (see handleDisputeClosed).
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const transaction = await findDisputedTransaction(dispute);

  await supabaseAdmin.from("disputes").upsert(
    {
      transaction_id: transaction?.id ?? null,
      stripe_dispute_id: dispute.id,
      amount_cents: dispute.amount,
      reason: dispute.reason ?? null,
      status: dispute.status,
    },
    { onConflict: "stripe_dispute_id" },
  );

  if (transaction?.id) {
    await supabaseAdmin
      .from("transactions")
      .update({ disputed_at: new Date().toISOString() })
      .eq("id", transaction.id);
  }
}

// A dispute resolved. If the seller lost it, claw their payout back by reversing
// the Connect transfer (the platform is debited by Stripe either way, so this is
// what makes the seller — not the platform — bear the chargeback). If they won,
// restore the buyer's access. Idempotent: the transfer is only ever reversed
// once, guarded by the disputes row's transfer_reversed flag.
async function handleDisputeClosed(dispute: Stripe.Dispute) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stripe = getStripeClient();
  const transaction = await findDisputedTransaction(dispute);

  const { data: existingDispute } = await supabaseAdmin
    .from("disputes")
    .select("transfer_reversed")
    .eq("stripe_dispute_id", dispute.id)
    .maybeSingle();

  // Resolve the Connect transfer that paid the seller for this charge.
  let transferId: string | null = null;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : (dispute.charge?.id ?? null);
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId, { expand: ["transfer"] });
      transferId = typeof charge.transfer === "string" ? charge.transfer : (charge.transfer?.id ?? null);
    } catch (error) {
      console.error("Dispute: could not resolve charge/transfer", dispute.id, error);
    }
  }

  const decision = decideDisputeClose({
    outcome: dispute.status,
    transferId,
    hasSeller: !!transaction?.seller_id,
    alreadyReversed: !!existingDispute?.transfer_reversed,
  });

  let transferReversed = !!existingDispute?.transfer_reversed;
  if (decision.kind === "reverse_transfer") {
    try {
      await stripe.transfers.createReversal(decision.transferId, {
        description: `Halvo: dispute ${dispute.id} lost`,
      });
      transferReversed = true;
    } catch (error) {
      // Leave transfer_reversed false so a retry can try again; never throw,
      // so Stripe doesn't keep redelivering the whole event.
      console.error("Dispute transfer reversal failed:", dispute.id, error);
    }
  }

  await supabaseAdmin.from("disputes").upsert(
    {
      transaction_id: transaction?.id ?? null,
      stripe_dispute_id: dispute.id,
      amount_cents: dispute.amount,
      reason: dispute.reason ?? null,
      status: dispute.status,
      transfer_reversed: transferReversed,
    },
    { onConflict: "stripe_dispute_id" },
  );

  // Won → the seller keeps their money and the buyer keeps access. Lost → leave
  // disputed_at set so access stays revoked and the badge stays.
  if (transaction?.id && decision.kind === "restore_access") {
    await supabaseAdmin.from("transactions").update({ disputed_at: null }).eq("id", transaction.id);
  }
}

// The subscriptions table is the single source of truth for plan tier —
// this is the only place that ever writes to it.
async function upsertSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("Webhook: subscription has no userId in metadata", subscription.id);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? "";
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : null,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id);
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
            case "charge.dispute.created":
              await handleDisputeCreated(event.data.object as Stripe.Dispute);
              break;
            case "charge.dispute.closed":
              await handleDisputeClosed(event.data.object as Stripe.Dispute);
              break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSubscription(event.data.object as Stripe.Subscription);
              break;
            case "customer.subscription.deleted":
              await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
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
