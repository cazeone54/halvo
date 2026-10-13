import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { onAccount, recordPaidInvoice } from "@/lib/recurring.server";

// Sellers have full Stripe accounts and may bill their own customers there; the
// connected-account webhook delivers those invoices to Halvo too.
describe("recordPaidInvoice", () => {
  const paidInvoice = (metadata: Record<string, string> | null) =>
    ({
      id: "in_1",
      status: "paid",
      parent: { subscription_details: { subscription: "sub_1", metadata } },
    }) as unknown as Stripe.Invoice;

  it("ignores a seller's own (non-Halvo) invoice without calling Stripe or the database", async () => {
    const retrieve = vi.fn();
    const stripe = { subscriptions: { retrieve } } as unknown as Stripe;
    const result = await recordPaidInvoice({} as never, stripe, paidInvoice({ plan: "their-own" }), { account: "acct_seller" });
    expect(result).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("looks a Halvo subscription up on the seller's account", async () => {
    const retrieve = vi.fn().mockResolvedValue({ metadata: {} }); // not a buyer sub → stops there
    const stripe = { subscriptions: { retrieve } } as unknown as Stripe;
    await recordPaidInvoice({} as never, stripe, paidInvoice({ halvo_kind: "buyer" }), { account: "acct_seller" });
    expect(retrieve).toHaveBeenCalledWith("sub_1", undefined, { stripeAccount: "acct_seller" });
  });
});

describe("onAccount", () => {
  it("targets the connected account, or the platform when there is none", () => {
    expect(onAccount("acct_1")).toEqual({ stripeAccount: "acct_1" });
    expect(onAccount(null)).toBeUndefined();
  });
});
