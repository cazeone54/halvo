import { describe, it, expect } from "vitest";
import {
  computeChargeAmountCents,
  isAboveMinimumCharge,
  enforcedMinCents,
  computeRequiredMinCents,
  buildDestinationChargeParams,
  isFreeProduct,
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

describe("isFreeProduct", () => {
  it("treats a zero-priced fixed product as free", () => {
    expect(isFreeProduct({ price_cents: 0, pay_what_you_want: false })).toBe(true);
  });

  it("never treats pay-what-you-want as free — it has a floor and takes payment", () => {
    expect(isFreeProduct({ price_cents: 0, pay_what_you_want: true })).toBe(false);
  });

  it("is false for anything with a price", () => {
    expect(isFreeProduct({ price_cents: 1, pay_what_you_want: false })).toBe(false);
    expect(isFreeProduct({ price_cents: 2000, pay_what_you_want: false })).toBe(false);
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

describe("computeRequiredMinCents", () => {
  it("equals enforcedMinCents when no coupon is present", () => {
    const product = { price_cents: 2000, pay_what_you_want: false };
    expect(computeRequiredMinCents(product, null)).toBe(2000);
  });

  it("recomputes the real discounted minimum when a coupon is present — the actual Kitsly fix", () => {
    // Kitsly only re-checked a coupon-discounted purchase against the flat
    // $0.50 floor, not the coupon's real discount — so a buyer could pay
    // less than the coupon actually allowed and still pass. Here, a 50%-off
    // coupon on a $20 product must require at least $10, not just $0.50.
    const product = { price_cents: 2000, pay_what_you_want: false };
    const coupon = { percent_off: 50, amount_off_cents: null };
    expect(computeRequiredMinCents(product, coupon)).toBe(1000);
  });

  it("still floors at the Stripe minimum for a near-100% coupon", () => {
    const product = { price_cents: 2000, pay_what_you_want: false };
    const coupon = { percent_off: 100, amount_off_cents: null };
    expect(computeRequiredMinCents(product, coupon)).toBe(MIN_CHARGE_CENTS);
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

  it("charges paid tiers a real but cheaper fee than free", () => {
    const free = buildDestinationChargeParams(10_00, "acct_123", "free").application_fee_amount;
    const creator = buildDestinationChargeParams(10_00, "acct_123", "creator").application_fee_amount;
    const pro = buildDestinationChargeParams(10_00, "acct_123", "pro").application_fee_amount;
    // Paid tiers used to be 0 here, which made every such sale a loss once
    // Stripe's own cut came out of the platform's balance.
    expect(pro).toBeGreaterThan(0);
    expect(pro).toBeLessThan(creator);
    expect(creator).toBeLessThan(free);
  });

  it("never sends a zero-amount destination charge with a nonzero fee", () => {
    const params = buildDestinationChargeParams(0, "acct_123", "free");
    expect(params.application_fee_amount).toBe(0);
  });

  it("withholds an affiliate commission on top of the platform fee", () => {
    // The actual money leak this fixes: the commission used to be written to a
    // ledger *after* the seller had already received the full transfer, so the
    // platform paid the affiliate out of a margin smaller than the commission.
    const commission = 100;
    const params = buildDestinationChargeParams(10_00, "acct_123", "creator", commission);
    expect(params.application_fee_amount).toBe(calcPlatformFeeCents("creator", 10_00) + commission);
  });

  it("leaves the fee untouched when there is no affiliate", () => {
    expect(buildDestinationChargeParams(10_00, "acct_123", "creator", 0).application_fee_amount).toBe(
      calcPlatformFeeCents("creator", 10_00),
    );
  });

  it("never withholds more than the charge itself", () => {
    const params = buildDestinationChargeParams(100, "acct_123", "free", 100_00);
    expect(params.application_fee_amount).toBeLessThanOrEqual(100);
  });
});
