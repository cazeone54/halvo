import { describe, it, expect } from "vitest";
import { normalizeTrafficSource } from "@/lib/traffic-source";

describe("normalizeTrafficSource", () => {
  it("prefers an explicit utm_source over the referrer", () => {
    expect(normalizeTrafficSource({ referrer: "https://instagram.com/", utmSource: "newsletter" })).toBe(
      "newsletter",
    );
  });

  it("falls back to the referring host, without the www", () => {
    expect(normalizeTrafficSource({ referrer: "https://www.reddit.com/r/notion" })).toBe("reddit.com");
  });

  it("resolves link shims to the real platform", () => {
    // A link shared on X arrives as t.co, which tells the seller nothing.
    expect(normalizeTrafficSource({ referrer: "https://t.co/abc123" })).toBe("x.com");
    expect(normalizeTrafficSource({ referrer: "https://l.instagram.com/?u=x" })).toBe("instagram.com");
  });

  it("counts our own pages as direct, not as a source", () => {
    expect(
      normalizeTrafficSource({ referrer: "https://halvo.io/u/ana", selfHost: "halvo.io" }),
    ).toBe("Direct");
  });

  it("returns Direct for a missing or unparseable referrer", () => {
    expect(normalizeTrafficSource({ referrer: null })).toBe("Direct");
    expect(normalizeTrafficSource({ referrer: "" })).toBe("Direct");
    expect(normalizeTrafficSource({ referrer: "not a url" })).toBe("Direct");
  });

  it("caps absurdly long values so one bad link can't wreck the report", () => {
    expect(normalizeTrafficSource({ utmSource: "x".repeat(500) }).length).toBeLessThanOrEqual(60);
  });
});
