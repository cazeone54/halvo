import { describe, it, expect, beforeAll } from "vitest";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_test_secret";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe("verifyStripeWebhook", () => {
  it("accepts a correctly signed payload", async () => {
    const { verifyStripeWebhook } = await import("@/lib/stripe.server");
    const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    const event = verifyStripeWebhook(payload, header);
    expect(event.id).toBe("evt_1");
    expect(event.type).toBe("payment_intent.succeeded");
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const { verifyStripeWebhook } = await import("@/lib/stripe.server");
    const payload = JSON.stringify({ id: "evt_2", type: "payment_intent.succeeded" });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong_secret" });

    expect(() => verifyStripeWebhook(payload, header)).toThrow();
  });

  it("rejects a tampered payload (signature no longer matches body)", async () => {
    const { verifyStripeWebhook } = await import("@/lib/stripe.server");
    const payload = JSON.stringify({ id: "evt_3", type: "payment_intent.succeeded" });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const tamperedPayload = JSON.stringify({ id: "evt_3", type: "payment_intent.succeeded", amount: 999999 });

    expect(() => verifyStripeWebhook(tamperedPayload, header)).toThrow();
  });

  it("rejects an expired timestamp", async () => {
    const { verifyStripeWebhook } = await import("@/lib/stripe.server");
    const payload = JSON.stringify({ id: "evt_4", type: "payment_intent.succeeded" });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 60 * 60; // 1 hour old
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
      timestamp: oldTimestamp,
    });

    expect(() => verifyStripeWebhook(payload, header)).toThrow();
  });
});
