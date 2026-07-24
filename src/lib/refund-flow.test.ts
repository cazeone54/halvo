import { describe, it, expect, vi } from "vitest";
import { performRefund, buildRefundParams, type RefundableTransaction } from "@/lib/refund-flow";

const baseTransaction: RefundableTransaction = {
  id: "txn_1",
  status: "success",
  refunded_at: null,
  stripe_payment_intent_id: "pi_123",
};

describe("buildRefundParams", () => {
  it("reverses the transfer so the seller funds their own refund", () => {
    // The actual bug this locks out: on a destination charge the refund comes
    // out of the PLATFORM's balance while the connected account keeps its
    // payout. Without reverse_transfer, refunding a $49 sale cost the platform
    // ~$48 and cost the seller nothing — so a seller could refund every sale
    // they made and the platform would fund all of it.
    expect(buildRefundParams("pi_123").reverse_transfer).toBe(true);
  });

  it("targets the right payment intent", () => {
    expect(buildRefundParams("pi_123").payment_intent).toBe("pi_123");
  });

  it("does not refund the application fee — it offsets Stripe's non-refundable cost", () => {
    expect(buildRefundParams("pi_123")).not.toHaveProperty("refund_application_fee", true);
  });
});

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
