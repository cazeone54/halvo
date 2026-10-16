import { describe, it, expect } from "vitest";
import { isGoneForGood } from "./stripe-account-gone";

const LIVE = "sk_live_x";
const TEST = "sk_test_x";

describe("isGoneForGood", () => {
  it("forgets an account live Stripe says is missing or no longer ours", () => {
    expect(isGoneForGood({ code: "resource_missing" }, LIVE)).toBe(true);
    expect(isGoneForGood({ code: "account_invalid" }, LIVE)).toBe(true);
    expect(isGoneForGood({ type: "StripePermissionError" }, LIVE)).toBe(true);
  });

  it("never forgets on test keys, which can't see live accounts", () => {
    expect(isGoneForGood({ code: "resource_missing" }, TEST)).toBe(false);
    expect(isGoneForGood({ code: "account_invalid" }, undefined)).toBe(false);
  });

  it("keeps the account through outages and timeouts", () => {
    expect(isGoneForGood({ type: "StripeConnectionError" }, LIVE)).toBe(false);
    expect(isGoneForGood({ type: "StripeAPIError", statusCode: 500 }, LIVE)).toBe(false);
    expect(isGoneForGood(new Error("timeout"), LIVE)).toBe(false);
    expect(isGoneForGood(null, LIVE)).toBe(false);
  });
});
