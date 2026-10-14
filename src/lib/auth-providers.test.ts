import { describe, expect, it } from "vitest";
import { AUTH_PROVIDERS, parseEnabledProviders } from "./auth-providers";

const ids = (raw: string | undefined | null) => parseEnabledProviders(raw).map((p) => p.id);

describe("parseEnabledProviders", () => {
  it("defaults to Google when unset, so a deploy that forgets the var still works", () => {
    expect(ids(undefined)).toEqual(["google"]);
    expect(ids(null)).toEqual(["google"]);
    expect(ids("")).toEqual(["google"]);
    expect(ids("   ")).toEqual(["google"]);
  });

  it("keeps the order given, so the most-used provider can be first", () => {
    expect(ids("apple,google,facebook")).toEqual(["apple", "google", "facebook"]);
    expect(ids("facebook,apple")).toEqual(["facebook", "apple"]);
  });

  it("tolerates spaces, newlines and mixed case", () => {
    expect(ids(" Google , APPLE \n github ")).toEqual(["google", "apple", "github"]);
  });

  it("accepts the names people will actually type", () => {
    expect(ids("linkedin")).toEqual(["linkedin_oidc"]);
    expect(ids("microsoft")).toEqual(["azure"]);
    expect(ids("twitter")).toEqual(["x"]);
    expect(ids("meta")).toEqual(["facebook"]);
  });

  it("drops unknown names rather than rendering a button that can't work", () => {
    expect(ids("google,myspace,orkut")).toEqual(["google"]);
  });

  it("falls back rather than leaving the page with no social buttons", () => {
    expect(ids("myspace")).toEqual(["google"]);
    expect(ids(",,,")).toEqual(["google"]);
  });

  it("de-duplicates, including via an alias", () => {
    expect(ids("google,google")).toEqual(["google"]);
    expect(ids("linkedin,linkedin_oidc")).toEqual(["linkedin_oidc"]);
    expect(ids("x,twitter")).toEqual(["x"]);
  });

  it("supports every provider in the catalogue", () => {
    const all = AUTH_PROVIDERS.map((p) => p.id);
    expect(ids(all.join(","))).toEqual(all);
  });

  it("gives every provider a display name", () => {
    for (const p of AUTH_PROVIDERS) {
      expect(p.name.length, p.id).toBeGreaterThan(0);
    }
  });
});
