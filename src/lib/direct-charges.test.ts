import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// DIRECT_CHARGES is read from import.meta.env at module load, so each branch is
// exercised by stubbing the env and re-importing with a clean module registry.
async function load(direct: boolean) {
  vi.resetModules();
  vi.stubEnv("VITE_STRIPE_DIRECT_CHARGES", direct ? "true" : "false");
  const plans = await import("@/lib/plans");
  const math = await import("@/lib/checkout-math");
  const refunds = await import("@/lib/refund-flow");
  return { plans, math, refunds };
}

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => vi.resetModules());

describe("direct charges — fee model", () => {
  it("drops to 5% with no fixed component", async () => {
    const { plans } = await load(true);
    expect(plans.DIRECT_CHARGES).toBe(true);
    expect(plans.UNIVERSAL_FEE_PCT).toBe(0.05);
    expect(plans.UNIVERSAL_FEE_FIXED_CENTS).toBe(0);
    // $49 -> $2.45, no 35c on top
    expect(plans.calcPlatformFeeCents("free", 4900)).toBe(245);
  });

  it("keeps 7% + 35c while destination charges are live", async () => {
    const { plans } = await load(false);
    expect(plans.DIRECT_CHARGES).toBe(false);
    expect(plans.calcPlatformFeeCents("free", 4900)).toBe(378);
  });

  it("is cheaper for the seller at every realistic price", async () => {
    const { plans: direct } = await load(true);
    const directFees = [500, 1500, 4900, 9900].map((a) => direct.calcPlatformFeeCents("free", a));
    const { plans: dest } = await load(false);
    const destFees = [500, 1500, 4900, 9900].map((a) => dest.calcPlatformFeeCents("free", a));
    directFees.forEach((f, i) => expect(f).toBeLessThan(destFees[i]));
  });
});

describe("direct charges — charge params", () => {
  it("creates the charge on the connected account with no transfer", async () => {
    const { math } = await load(true);
    const charge = math.buildChargeParams(4900, "acct_seller", "free");
    expect(charge.mode).toBe("direct");
    expect(charge.stripeAccount).toBe("acct_seller");
    expect(charge.params.application_fee_amount).toBe(245);
    // The giveaways that it is NOT a destination charge:
    expect(charge.params).not.toHaveProperty("transfer_data");
    expect(charge.params).not.toHaveProperty("on_behalf_of");
  });

  it("still routes via transfer_data when direct charges are off", async () => {
    const { math } = await load(false);
    const charge = math.buildChargeParams(4900, "acct_seller", "free");
    expect(charge.mode).toBe("destination");
    expect(charge.stripeAccount).toBeUndefined();
    expect(charge.params).toHaveProperty("transfer_data", { destination: "acct_seller" });
  });

  it("withholds the affiliate commission on top of the fee, same as before", async () => {
    const { math } = await load(true);
    const plain = math.buildChargeParams(4900, "acct_seller", "free");
    const referred = math.buildChargeParams(4900, "acct_seller", "free", 490);
    expect(referred.params.application_fee_amount).toBe(plain.params.application_fee_amount + 490);
  });

  it("never lets the application fee exceed the charge", async () => {
    const { math } = await load(true);
    const charge = math.buildChargeParams(50, "acct_seller", "free", 10_000);
    expect(charge.params.application_fee_amount).toBeLessThanOrEqual(50);
  });

  it("returns a zero fee on a zero charge", async () => {
    const { math } = await load(true);
    expect(math.buildChargeParams(0, "acct_seller", "free").params.application_fee_amount).toBe(0);
  });
});

describe("direct charges — refunds", () => {
  it("has no transfer to reverse and returns the platform fee", async () => {
    const { refunds } = await load(true);
    const params = refunds.buildRefundParams("pi_123");
    expect(params.payment_intent).toBe("pi_123");
    expect(params.reverse_transfer).toBeUndefined();
    // No sale happened, so the seller should not be left paying Halvo's cut.
    expect(params.refund_application_fee).toBe(true);
  });

  it("still reverses the transfer under destination charges", async () => {
    const { refunds } = await load(false);
    const params = refunds.buildRefundParams("pi_123");
    expect(params.reverse_transfer).toBe(true);
    // Deliberately absent there: the kept fee offsets Stripe's unreturned cost.
    expect(params.refund_application_fee).toBeUndefined();
  });
});
