import { describe, it, expect, vi } from "vitest";
import { performRefund, type RefundableTransaction } from "@/lib/refund-flow";

const baseTransaction: RefundableTransaction = {
  id: "txn_1",
  status: "success",
  refunded_at: null,
  stripe_payment_intent_id: "pi_123",
};

describe("performRefund", () => {
  it("calls Stripe before writing the DB update — not the other way around", async () => {
    const calls: string[] = [];
    const createStripeRefund = vi.fn(async () => {
      calls.push("stripe");
    });
    const markTransactionRefunded = vi.fn(async () => {
      calls.push("db");
    });

    await performRefund(baseTransaction, { createStripeRefund, markTransactionRefunded });

    expect(calls).toEqual(["stripe", "db"]);
    expect(createStripeRefund).toHaveBeenCalledWith("pi_123");
    expect(markTransactionRefunded).toHaveBeenCalledWith("txn_1");
  });

  it("never writes the DB update if the Stripe refund call fails — the actual Kitsly bug this fixes", async () => {
    const createStripeRefund = vi.fn(async () => {
      throw new Error("Stripe declined the refund");
    });
    const markTransactionRefunded = vi.fn(async () => {});

    await expect(performRefund(baseTransaction, { createStripeRefund, markTransactionRefunded })).rejects.toThrow(
      "Stripe declined the refund",
    );
    expect(markTransactionRefunded).not.toHaveBeenCalled();
  });

  it("is idempotent — already-refunded transactions skip Stripe entirely", async () => {
    const createStripeRefund = vi.fn(async () => {});
    const markTransactionRefunded = vi.fn(async () => {});

    const result = await performRefund(
      { ...baseTransaction, status: "refunded", refunded_at: "2026-01-01T00:00:00Z" },
      { createStripeRefund, markTransactionRefunded },
    );

    expect(result).toEqual({ refunded: true });
    expect(createStripeRefund).not.toHaveBeenCalled();
    expect(markTransactionRefunded).not.toHaveBeenCalled();
  });

  it("refuses to refund a transaction with no Stripe payment intent", async () => {
    const createStripeRefund = vi.fn(async () => {});
    const markTransactionRefunded = vi.fn(async () => {});

    await expect(
      performRefund(
        { ...baseTransaction, stripe_payment_intent_id: null },
        { createStripeRefund, markTransactionRefunded },
      ),
    ).rejects.toThrow("no associated Stripe payment");
    expect(createStripeRefund).not.toHaveBeenCalled();
  });
});
