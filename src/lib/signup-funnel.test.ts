import { describe, expect, it } from "vitest";
import { buildSignupFunnel, type FunnelAccount, type FunnelFacts } from "./signup-funnel";

const now = new Date("2026-11-08T12:00:00Z");
const acc = (id: string, createdAt: string, confirmed = true, source: string | null = null): FunnelAccount => ({
  id,
  createdAt,
  confirmed,
  source,
});

const accounts = [
  acc("old", "2026-09-01T10:00:00Z", true, "ig"),
  acc("a", "2026-11-06T13:55:00Z", false),
  acc("b", "2026-11-06T13:56:00Z", true, "Direct"),
  acc("c", "2026-11-03T20:45:00Z", true, "google"),
  acc("d", "2026-10-29T18:39:00Z", true, "ig"),
];
const facts: FunnelFacts = {
  productOwners: new Set(["b", "c", "old"]),
  liveOwners: new Set(["c", "old"]),
  stripeStarted: new Set(["c", "d"]),
  stripeDone: new Set(["old"]),
  firstBuyer: new Set(["old"]),
};

describe("buildSignupFunnel", () => {
  it("counts each step for the accounts made in the period", () => {
    const { steps } = buildSignupFunnel(accounts, facts, new Date("2026-10-09T12:00:00Z"), now);
    expect(Object.fromEntries(steps.map((s) => [s.key, s.count]))).toEqual({
      signedUp: 4,
      gotIn: 3,
      product: 2,
      live: 1,
      stripeStarted: 2,
      stripeDone: 0,
      firstBuyer: 0,
    });
    expect(steps.find((s) => s.key === "live")?.ofSignups).toBe(0.25);
  });

  it("all time includes everyone", () => {
    const { steps } = buildSignupFunnel(accounts, facts, null, now);
    expect(steps[0].count).toBe(5);
    expect(steps.find((s) => s.key === "firstBuyer")?.count).toBe(1);
  });

  it("says where sign-ups came from, unknown ones included", () => {
    const { sources } = buildSignupFunnel(accounts, facts, new Date("2026-10-09T12:00:00Z"), now);
    expect(sources).toEqual([
      { source: "Direct", count: 1 },
      { source: "google", count: 1 },
      { source: "ig", count: 1 },
      { source: "Not recorded", count: 1 },
    ]);
  });

  it("shows sign-ups per day for the last two weeks, so a burst stands out", () => {
    const { perDay } = buildSignupFunnel(accounts, facts, null, now);
    expect(perDay).toHaveLength(14);
    expect(perDay[13].day).toBe("2026-11-08");
    expect(perDay.find((d) => d.day === "2026-11-06")?.count).toBe(2);
  });

  it("has no percentages when nobody signed up", () => {
    const { steps } = buildSignupFunnel([], facts, null, now);
    expect(steps.every((s) => s.count === 0 && s.ofSignups === null)).toBe(true);
  });
});
