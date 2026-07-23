// Pure decision logic for the race between the client-driven
// recordSuccessfulTransaction call and the webhook's payment_intent.succeeded
// reconciliation fallback — both can try to insert the same transaction row.
// Whichever loses that insert race still needs to backfill whatever fields
// only it knows about onto the row the other side actually wrote.
export type ExistingTransactionRow = {
  buyer_id: string | null;
  coupon_code: string | null;
  terms_acked_at: string | null;
};

export type CandidateTransactionData = {
  buyerId: string | null;
  couponCode: string | null;
  termsAckedAt: string | null;
};

export function computeTransactionBackfill(
  existing: ExistingTransactionRow,
  candidate: CandidateTransactionData,
): Partial<{ buyer_id: string; coupon_code: string; terms_acked_at: string }> {
  const backfill: Partial<{ buyer_id: string; coupon_code: string; terms_acked_at: string }> = {};
  if (!existing.buyer_id && candidate.buyerId) backfill.buyer_id = candidate.buyerId;
  if (!existing.coupon_code && candidate.couponCode) backfill.coupon_code = candidate.couponCode;
  // The webhook fallback never sees the buyer's final-sale acknowledgment (it
  // only exists in the browser), so if it won the insert race, backfill the
  // consent timestamp onto its row from the client-driven call.
  if (!existing.terms_acked_at && candidate.termsAckedAt) backfill.terms_acked_at = candidate.termsAckedAt;
  return backfill;
}
