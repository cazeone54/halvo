import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

describe("isCronAuthorized", () => {
  it("accepts the right bearer token", async () => {
    expect(await isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("refuses a wrong, partial or missing token", async () => {
    expect(await isCronAuthorized("Bearer s3cres", "s3cret")).toBe(false);
    expect(await isCronAuthorized("Bearer s3cre", "s3cret")).toBe(false);
    expect(await isCronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(await isCronAuthorized("", "s3cret")).toBe(false);
    expect(await isCronAuthorized(null, "s3cret")).toBe(false);
  });

  it("refuses everything when no secret is set", async () => {
    expect(await isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(await isCronAuthorized("Bearer ", "")).toBe(false);
    expect(await isCronAuthorized(null, undefined)).toBe(false);
  });
});
