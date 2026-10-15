import { describe, expect, it } from "vitest";
import { parseOtpType, safeNextPath } from "./auth-confirm";

describe("safeNextPath", () => {
  it("accepts a same-site path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard/settings?tab=1")).toBe("/dashboard/settings?tab=1");
  });

  it("refuses anything that leaves the site — the open-redirect cases", () => {
    for (const bad of [
      "https://evil.example/login",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ok\r\nLocation: https://evil.example",
    ]) {
      expect(safeNextPath(bad), bad).toBe("/dashboard");
    }
  });

  it("falls back on missing or odd input", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(42)).toBe("/dashboard");
    expect(safeNextPath("/" + "a".repeat(600))).toBe("/dashboard");
  });
});

describe("parseOtpType", () => {
  it("accepts the types Supabase issues", () => {
    expect(parseOtpType("email")).toBe("email");
    expect(parseOtpType("magiclink")).toBe("magiclink");
    expect(parseOtpType("signup")).toBe("signup");
  });

  it("rejects anything else", () => {
    expect(parseOtpType("sms")).toBeNull();
    expect(parseOtpType("")).toBeNull();
    expect(parseOtpType(undefined)).toBeNull();
  });
});
