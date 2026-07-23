import { describe, it, expect } from "vitest";
import { computeTransactionBackfill } from "@/lib/transaction-race";

describe("computeTransactionBackfill", () => {
  it("backfills coupon_code when the winning writer didn't set it — the actual bug this fixes", () => {
    // Reproduces the exact bug hit in testing: the webhook's reconciliation
    // fallback won the insert race and wrote a bare row with no coupon_code,
    // silently discarding a real 20%-off discount from the purchase record.
    const existing = { buyer_id: null, coupon_code: null, terms_acked_at: null };
    const backfill = computeTransactionBackfill(existing, {
      buyerId: null,
      couponCode: "SAVE20",
      termsAckedAt: null,
    });
    expect(backfill).toEqual({ coupon_code: "SAVE20" });
  });

  it("backfills buyer_id when the winning writer didn't set it", () => {
    const existing = { buyer_id: null, coupon_code: null, terms_acked_at: null };
    const backfill = computeTransactionBackfill(existing, {
      buyerId: "user-123",
      couponCode: null,
      termsAckedAt: null,
    });
    expect(backfill).toEqual({ buyer_id: "user-123" });
  });

  it("backfills the final-sale acknowledgment when the webhook won the race", () => {
    // The webhook fallback can't know the buyer ticked the final-sale box —
    // that only exists client-side — so its bare row would otherwise lose the
    // consent evidence a seller needs to defend a chargeback.
    const existing = { buyer_id: "user-123", coupon_code: null, terms_acked_at: null };
    const backfill = computeTransactionBackfill(existing, {
      buyerId: "user-123",
      couponCode: null,
      termsAckedAt: "2026-07-23T10:00:00.000Z",
    });
    expect(backfill).toEqual({ terms_acked_at: "2026-07-23T10:00:00.000Z" });
  });

  it("never overwrites a field the existing row already has", () => {
    const existing = {
      buyer_id: "user-original",
      coupon_code: "ALREADY-SET",
      terms_acked_at: "2026-07-23T09:00:00.000Z",
    };
    const backfill = computeTransactionBackfill(existing, {
      buyerId: "user-different",
      couponCode: "SOMETHING-ELSE",
      termsAckedAt: "2026-07-23T10:00:00.000Z",
    });
    expect(backfill).toEqual({});
  });

  it("produces an empty patch when there is nothing to backfill", () => {
    const existing = { buyer_id: null, coupon_code: null, terms_acked_at: null };
    expect(
      computeTransactionBackfill(existing, { buyerId: null, couponCode: null, termsAckedAt: null }),
    ).toEqual({});
  });
});
