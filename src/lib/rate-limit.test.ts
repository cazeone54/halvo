import { describe, it, expect } from "vitest";
import { pruneAndCheck } from "@/lib/rate-limit";

describe("pruneAndCheck", () => {
  it("allows requests under the limit", () => {
    const result = pruneAndCheck([], 1000, 3, 60_000);
    expect(result.limited).toBe(false);
    expect(result.updated).toEqual([1000]);
  });

  it("blocks once the window is at capacity", () => {
    const existing = [1000, 2000, 3000];
    const result = pruneAndCheck(existing, 4000, 3, 60_000);
    expect(result.limited).toBe(true);
    // A blocked request must not be added to the tracked timestamps.
    expect(result.updated).toEqual(existing);
  });

  it("prunes timestamps outside the window before checking capacity", () => {
    const existing = [0, 1000, 2000]; // all older than a 5s window at t=10000
    const result = pruneAndCheck(existing, 10_000, 3, 5_000);
    expect(result.limited).toBe(false);
    expect(result.updated).toEqual([10_000]);
  });

  it("allows exactly maxRequests within the window, then blocks the next one", () => {
    let timestamps: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = pruneAndCheck(timestamps, i * 100, 5, 60_000);
      expect(result.limited).toBe(false);
      timestamps = result.updated;
    }
    const sixth = pruneAndCheck(timestamps, 500, 5, 60_000);
    expect(sixth.limited).toBe(true);
  });
});
