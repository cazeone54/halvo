import { describe, it, expect } from "vitest";
import { describeConnectStatus, humanizeRequirement } from "@/lib/stripe-requirements";

describe("humanizeRequirement", () => {
  it("translates the requirement keys sellers actually hit", () => {
    expect(humanizeRequirement("external_account")).toBe("Your bank account, for payouts");
    expect(humanizeRequirement("individual.verification.document")).toBe("A photo of your ID");
  });

  it("stays readable for keys it doesn't know", () => {
    // Stripe adds requirement keys over time; an unknown one must never surface
    // as a raw dotted path in the seller's dashboard.
    const label = humanizeRequirement("individual.political_exposure");
    expect(label).toBe("Political exposure");
    expect(label).not.toContain(".");
    expect(label).not.toContain("_");
  });
});

describe("describeConnectStatus", () => {
  const base = { connected: true, chargesEnabled: false, detailsSubmitted: false, requirementsDue: [] };

  it("reports ready once charges are enabled", () => {
    const r = describeConnectStatus({ ...base, chargesEnabled: true });
    expect(r.state).toBe("ready");
    expect(r.items).toEqual([]);
  });

  it("reports not started when there's no account yet", () => {
    expect(describeConnectStatus({ ...base, connected: false }).state).toBe("not_started");
  });

  it("lists what's outstanding when Stripe is waiting on the seller", () => {
    const r = describeConnectStatus({ ...base, requirementsDue: ["external_account"] });
    expect(r.state).toBe("needs_info");
    expect(r.items).toEqual(["Your bank account, for payouts"]);
  });

  it("does not tell a seller about their date of birth three times", () => {
    // Stripe lists dob.day, dob.month and dob.year separately.
    const r = describeConnectStatus({
      ...base,
      requirementsDue: ["individual.dob.day", "individual.dob.month", "individual.dob.year"],
    });
    expect(r.items).toEqual(["Your date of birth"]);
  });

  it("says it's under review when everything was submitted and nothing is due", () => {
    const r = describeConnectStatus({ ...base, detailsSubmitted: true });
    expect(r.state).toBe("in_review");
  });
});
