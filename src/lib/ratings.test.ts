import { describe, it, expect } from "vitest";
import { summarizeRatings } from "@/lib/ratings";

describe("summarizeRatings", () => {
  it("returns an empty summary with no ratings", () => {
    expect(summarizeRatings([])).toEqual({ count: 0, average: 0, rounded: 0 });
  });

  it("averages to one decimal", () => {
    const s = summarizeRatings([5, 4, 5]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(4.7);
  });

  it("rounds the display value to the nearest half so stars don't lie", () => {
    // 4.6 must not render as five full stars.
    expect(summarizeRatings([5, 5, 5, 5, 3]).rounded).toBe(4.5);
    expect(summarizeRatings([4, 5]).rounded).toBe(4.5);
  });

  it("ignores values outside 1–5 rather than letting them skew the average", () => {
    expect(summarizeRatings([5, 0, 9, -2, 5])).toEqual({ count: 2, average: 5, rounded: 5 });
  });

  it("handles a single rating", () => {
    expect(summarizeRatings([4])).toEqual({ count: 1, average: 4, rounded: 4 });
  });
});
