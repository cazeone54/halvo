import { describe, it, expect } from "vitest";
import { isSetUp } from "./onboarding-checklist";

const setUp = { handle: "halvo-press", hasProduct: true, stripeConnected: true, hasSupportEmail: true };

describe("when the setup card stops appearing", () => {
  it("is finished once the account can actually sell", () => {
    expect(isSetUp(setUp)).toBe(true);
  });

  it("keeps showing while any of the four is missing", () => {
    expect(isSetUp({ ...setUp, handle: null })).toBe(false);
    expect(isSetUp({ ...setUp, hasProduct: false })).toBe(false);
    expect(isSetUp({ ...setUp, stripeConnected: false })).toBe(false);
    expect(isSetUp({ ...setUp, hasSupportEmail: false })).toBe(false);
  });

  it("doesn't count an empty handle as claimed", () => {
    expect(isSetUp({ ...setUp, handle: "" })).toBe(false);
  });

  it("does not depend on having shared a link, which is only ever a flag in one browser", () => {
    // The seller above has never clicked "Copy link" here; the card is still done.
    expect(isSetUp(setUp)).toBe(true);
  });
});
