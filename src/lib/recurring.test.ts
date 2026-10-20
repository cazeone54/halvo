import { describe, expect, it } from "vitest";
import {
  applicationFeePercent,
  billsRepeatedly,
  installmentAmountCents,
  installmentCancelAt,
  signManageToken,
  subscriptionAccess,
  validateBilling,
  verifyManageToken,
  type SubscriptionSnapshot,
} from "./recurring";
import { calcPlatformFeeCents } from "./plans";

const now = new Date("2026-10-11T12:00:00Z");
const base: SubscriptionSnapshot = {
  kind: "membership",
  status: "active",
  installments_total: null,
  installments_paid: 1,
  current_period_end: "2026-11-11T12:00:00Z",
  past_due_since: null,
};

describe("installmentAmountCents", () => {
  it("rounds up so the plan never totals less than the price", () => {
    expect(installmentAmountCents(4900, 3)).toBe(1634);
    expect(installmentAmountCents(4900, 3) * 3).toBeGreaterThanOrEqual(4900);
    expect(installmentAmountCents(6000, 3)).toBe(2000);
  });
});

describe("applicationFeePercent", () => {
  it("collects at least the same fee as Halvo's pct + fixed fee", () => {
    for (const amount of [100, 999, 1634, 4900, 29900]) {
      for (const tier of ["free", "creator", "pro"] as const) {
        const fee = calcPlatformFeeCents(tier, amount);
        const pct = applicationFeePercent(fee, amount);
        expect(Math.round((amount * pct) / 100)).toBeGreaterThanOrEqual(fee);
        expect(Math.round((amount * pct) / 100) - fee).toBeLessThanOrEqual(1 + Math.ceil(amount / 10000));
      }
    }
  });
  it("is capped at 100 and 0 for nothing", () => {
    expect(applicationFeePercent(500, 100)).toBe(100);
    expect(applicationFeePercent(10, 0)).toBe(0);
  });
});

describe("installmentCancelAt", () => {
  // Cases verified against Stripe test clocks: exactly n full payments, then it ends.
  it("ends exactly at the boundary after the last period, keeping the anchor day", () => {
    // Jan 31 anchor: Jan 31, Feb 28, Mar 31 are the 3 payments; ends Apr 30.
    expect(new Date(installmentCancelAt(new Date("2026-01-31T10:00:00Z"), 3) * 1000).toISOString()).toBe(
      "2026-04-30T10:00:00.000Z",
    );
    expect(new Date(installmentCancelAt(new Date("2026-03-15T22:30:00Z"), 2) * 1000).toISOString()).toBe(
      "2026-05-15T22:30:00.000Z",
    );
    expect(new Date(installmentCancelAt(new Date("2026-05-31T23:59:00Z"), 4) * 1000).toISOString()).toBe(
      "2026-09-30T23:59:00.000Z",
    );
  });
  it("crosses year ends", () => {
    expect(new Date(installmentCancelAt(new Date("2026-11-30T00:00:00Z"), 3) * 1000).toISOString()).toBe(
      "2027-02-28T00:00:00.000Z",
    );
  });
});

describe("subscriptionAccess", () => {
  it("gives access to an active membership", () => {
    expect(subscriptionAccess(base, now)).toEqual({ access: true, state: "active" });
  });

  it("keeps access for 7 days after a failed payment, then suspends", () => {
    const failed = { ...base, status: "past_due", past_due_since: "2026-10-06T12:00:00Z" };
    expect(subscriptionAccess(failed, now)).toMatchObject({ access: true, state: "grace" });
    const late = { ...failed, past_due_since: "2026-10-04T11:59:00Z" };
    expect(subscriptionAccess(late, now)).toEqual({ access: false, state: "suspended" });
  });

  it("grace applies even after Stripe cancels for non-payment", () => {
    const canceled = { ...base, status: "canceled", past_due_since: "2026-10-10T12:00:00Z" };
    expect(subscriptionAccess(canceled, now).access).toBe(true);
    expect(subscriptionAccess({ ...canceled, past_due_since: "2026-09-01T00:00:00Z" }, now)).toEqual({
      access: false,
      state: "ended",
    });
  });

  it("a membership cancelled in good standing lasts to the end of the paid period", () => {
    const canceled = { ...base, status: "canceled" };
    expect(subscriptionAccess(canceled, now)).toMatchObject({ access: true, state: "ending" });
    expect(subscriptionAccess({ ...canceled, current_period_end: "2026-10-01T00:00:00Z" }, now).access).toBe(false);
  });

  it("a completed payment plan is owned forever, even once Stripe ends it", () => {
    const plan = { ...base, kind: "installments" as const, installments_total: 3, installments_paid: 3, status: "canceled" };
    expect(subscriptionAccess(plan, now)).toEqual({ access: true, state: "owned" });
  });

  it("a payment plan abandoned part-way loses access once grace is over", () => {
    const plan = {
      ...base,
      kind: "installments" as const,
      installments_total: 3,
      installments_paid: 1,
      status: "canceled",
      past_due_since: "2026-09-20T00:00:00Z",
    };
    expect(subscriptionAccess(plan, now)).toEqual({ access: false, state: "ended" });
    expect(subscriptionAccess({ ...plan, status: "active", past_due_since: null }, now).access).toBe(true);
  });
});

describe("validateBilling", () => {
  const ok = { billingType: "one_time" as const, billingInterval: null, installmentCount: null, priceCents: 4900, payWhatYouWant: false };
  it("accepts one-time, payment plans and memberships", () => {
    expect(validateBilling(ok)).toBeNull();
    expect(validateBilling({ ...ok, installmentCount: 3 })).toBeNull();
    expect(validateBilling({ ...ok, billingType: "membership", billingInterval: "month" })).toBeNull();
  });
  it("rejects bad combinations", () => {
    expect(validateBilling({ ...ok, billingType: "membership", billingInterval: null })).toMatch(/monthly or yearly/);
    expect(validateBilling({ ...ok, billingType: "membership", billingInterval: "month", payWhatYouWant: true })).toMatch(/fixed price/);
    expect(validateBilling({ ...ok, billingType: "membership", billingInterval: "month", priceCents: 0 })).toMatch(/at least/);
    expect(validateBilling({ ...ok, installmentCount: 13 })).toMatch(/2 to 12/);
    expect(validateBilling({ ...ok, installmentCount: 12, priceCents: 300 })).toMatch(/too small/);
    expect(validateBilling({ ...ok, installmentCount: 3, payWhatYouWant: true })).toMatch(/Pay-what/);
  });
});

// Decides whether the pricing-model chooser appears in the product editor at
// all. A product that bills once never sees it; one that bills repeatedly must,
// or there is no way left to turn the charges off.
describe("billsRepeatedly", () => {
  it("is false for an ordinary one-off product", () => {
    expect(billsRepeatedly({ billingType: "one_time", installmentCount: null })).toBe(false);
    expect(billsRepeatedly({ billingType: null, installmentCount: null })).toBe(false);
    expect(billsRepeatedly({ billingType: undefined, installmentCount: undefined })).toBe(false);
    // 0 installments is not a payment plan — it's the absence of one.
    expect(billsRepeatedly({ billingType: "one_time", installmentCount: 0 })).toBe(false);
  });

  it("is true for a membership or a payment plan", () => {
    expect(billsRepeatedly({ billingType: "membership", installmentCount: null })).toBe(true);
    expect(billsRepeatedly({ billingType: "one_time", installmentCount: 3 })).toBe(true);
  });
});

describe("manage tokens", () => {
  const id = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";
  it("round-trips and rejects tampering or the wrong secret", async () => {
    const token = await signManageToken(id, "s3cret");
    expect(await verifyManageToken(token, "s3cret")).toBe(id);
    expect(await verifyManageToken(token, "other")).toBeNull();
    expect(await verifyManageToken(token.replace(id, "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e60"), "s3cret")).toBeNull();
    expect(await verifyManageToken("garbage", "s3cret")).toBeNull();
  });
});
