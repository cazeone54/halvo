import { describe, expect, it } from "vitest";
import { describeAdvancedOptions } from "./advanced-options";

describe("describeAdvancedOptions", () => {
  it("returns null when nothing is set", () => {
    expect(describeAdvancedOptions({ licenseEnabled: false })).toBeNull();
  });

  it("names license keys when they're on", () => {
    expect(describeAdvancedOptions({ licenseEnabled: true })).toBe("License keys on");
  });
});
