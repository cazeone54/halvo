import { describe, expect, it } from "vitest";
import { describeAdvancedOptions } from "./advanced-options";

describe("describeAdvancedOptions", () => {
  it("returns null when nothing is set", () => {
    expect(describeAdvancedOptions({ refundPolicy: "", licenseEnabled: false })).toBeNull();
  });

  it("treats a whitespace-only refund policy as unset", () => {
    expect(describeAdvancedOptions({ refundPolicy: "   ", licenseEnabled: false })).toBeNull();
  });

  it("names a single active option, capitalised", () => {
    expect(describeAdvancedOptions({ refundPolicy: "14 days", licenseEnabled: false })).toBe("Custom refund policy");
    expect(describeAdvancedOptions({ refundPolicy: "", licenseEnabled: true })).toBe("License keys on");
  });

  it("joins both when both are active", () => {
    expect(describeAdvancedOptions({ refundPolicy: "14 days", licenseEnabled: true })).toBe(
      "Custom refund policy · license keys on",
    );
  });
});
