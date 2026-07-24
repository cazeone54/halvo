// Pure orchestration, dependencies injected so it's testable without
// mocking the Stripe SDK or Supabase client modules. This is the actual
// Kitsly fix: Stripe must confirm the refund before the DB is ever updated.
export type RefundDeps = {
  createStripeRefund: (paymentIntentId: string) => Promise<void>;
  markTransactionRefunded: (transactionId: string) => Promise<void>;
};

export type RefundableTransaction = {
  id: string;
  status: string;
  refunded_at: string | null;
  stripe_payment_intent_id: string | null;
};

export type StripeRefundParams = {
  payment_intent: string;
  reverse_transfer: boolean;
};

// The refund on a Connect *destination* charge is paid out of the PLATFORM's
// balance, and the connected account keeps its payout unless the transfer is
// explicitly reversed. Without `reverse_transfer` a seller could refund every
// sale they ever made and the platform would fund all of it — roughly the full
// sale amount lost per refund.
//
// `refund_application_fee` is deliberately left off: platform fees are
// non-refundable (industry standard), and keeping the fee offsets Stripe's own
// processing fee, which Stripe does not return on a refund. Because the fee is
// guaranteed to clear that cost (see the invariant test in plans.test.ts), a
// refund lands close to cost-neutral for the platform instead of catastrophic.
export function buildRefundParams(paymentIntentId: string): StripeRefundParams {
  return { payment_intent: paymentIntentId, reverse_transfer: true };
}

export async function performRefund(transaction: RefundableTransaction, deps: RefundDeps): Promise<{ refunded: true }> {
  if (transaction.status === "refunded" || transaction.refunded_at) {
    return { refunded: true };
  }
  if (!transaction.stripe_payment_intent_id) {
    throw new Error("This transaction has no associated Stripe payment.");
  }

  // Stripe call happens first, deliberately not in parallel with the DB
  // write — if it throws, `markTransactionRefunded` must never run.
  await deps.createStripeRefund(transaction.stripe_payment_intent_id);
  await deps.markTransactionRefunded(transaction.id);

  return { refunded: true };
}
