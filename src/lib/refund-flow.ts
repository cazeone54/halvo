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
