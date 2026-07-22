import { describe, it, expect } from "vitest";
import {
  computeChargeAmountCents,
  isAboveMinimumCharge,
  enforcedMinCents,
  buildDestinationChargeParams,
} from "@/lib/checkout-math";
import { MIN_CHARGE_CENTS } from "@/lib/fees";
import { calcPlatformFeeCents } from "@/lib/plans";

describe("computeChargeAmountCents", () => {
  it("uses the fixed price for non-PWYW products regardless of requested amount", () => {
    const product = { price_cents: 2000, pay_what_you_want: false };
    expect(computeChargeAmountCents(product, 1)).toBe(2000);
    expect(computeChargeAmountCents(product, 999_999)).toBe(2000);
    expect(computeChargeAmountCents(product, undefined)).toBe(2000);
  });

  it("lets pay-what-you-want bump the price up", () => {
    const product = { price_cents: 500, pay_what_you_want: true };
    expect(computeChargeAmountCents(product, 5000)).toBe(5000);
  });

  it("never lets pay-what-you-want go below the product's price", () => {
    const product = { price_cents: 500, pay_what_you_want: true };
    // A client trying to lowball a PWYW product must be floored at price_cents.
    expect(computeChargeAmountCents(product, 1)).toBe(500);
    expect(computeChargeAmountCents(product, undefined)).toBe(500);
  });
});

describe("isAboveMinimumCharge / enforcedMinCents", () => {
  it("rejects amounts below the Stripe minimum", () => {
    expect(isAboveMinimumCharge(MIN_CHARGE_CENTS - 1)).toBe(false);
    expect(isAboveMinimumCharge(MIN_CHARGE_CENTS)).toBe(true);
  });

  it("enforces the fixed price as the minimum for non-PWYW products", () => {
    expect(enforcedMinCents({ price_cents: 2000, pay_what_you_want: false })).toBe(2000);
  });

  it("enforces only the Stripe floor for PWYW products", () => {
    expect(enforcedMinCents({ price_cents: 2000, pay_what_you_want: true })).toBe(MIN_CHARGE_CENTS);
  });
});

describe("buildDestinationChargeParams", () => {
  it("charges the platform fee for a free-tier seller", () => {
    const params = buildDestinationChargeParams(10_00, "acct_123", "free");
    expect(params.amount).toBe(10_00);
    expect(params.application_fee_amount).toBe(calcPlatformFeeCents("free", 10_00));
    expect(params.application_fee_amount).toBeGreaterThan(0);
    expect(params.transfer_data).toEqual({ destination: "acct_123" });
  });

  it("charges zero platform fee for a creator/pro-tier seller", () => {
    expect(buildDestinationChargeParams(10_00, "acct_123", "creator").application_fee_amount).toBe(0);
    expect(buildDestinationChargeParams(10_00, "acct_123", "pro").application_fee_amount).toBe(0);
  });

  it("never sends a zero-amount destination charge with a nonzero fee", () => {
    const params = buildDestinationChargeParams(0, "acct_123", "free");
    expect(params.application_fee_amount).toBe(0);
  });
});
