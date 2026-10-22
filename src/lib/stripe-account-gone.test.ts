import { describe, it, expect } from "vitest";
import { isGoneForGood, platformMismatch } from "./stripe-account-gone";

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

  // Halvo owns two Stripe accounts, and the seller account's key makes every
  // connected seller look missing. Clearing them all is unrecoverable.
  it("is refused when the key belongs to a different Stripe account", () => {
    expect(platformMismatch("acct_seller", "acct_platform")).toBe(true);
    expect(platformMismatch("acct_platform", "acct_platform")).toBe(false);
    expect(platformMismatch("  acct_platform  ", "acct_platform")).toBe(false);
  });

  it("doesn't block the clearing when there is nothing to compare against", () => {
    // Unset variable, or Stripe unreachable — unknown is not a mismatch, and
    // guessing either way here would be worse than today's behaviour.
    expect(platformMismatch("acct_whatever", undefined)).toBe(false);
    expect(platformMismatch("acct_whatever", "   ")).toBe(false);
    expect(platformMismatch(null, "acct_platform")).toBe(false);
  });

  it("keeps the account through outages and timeouts", () => {
    expect(isGoneForGood({ type: "StripeConnectionError" }, LIVE)).toBe(false);
    expect(isGoneForGood({ type: "StripeAPIError", statusCode: 500 }, LIVE)).toBe(false);
    expect(isGoneForGood(new Error("timeout"), LIVE)).toBe(false);
    expect(isGoneForGood(null, LIVE)).toBe(false);
  });
});
