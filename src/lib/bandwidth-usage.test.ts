import { describe, it, expect } from "vitest";
import { computeBandwidthStatus } from "@/lib/bandwidth-usage";

const GB = 1024 * 1024 * 1024;

describe("computeBandwidthStatus", () => {
  it("reports ok well under the limit", () => {
    const s = computeBandwidthStatus(10 * GB, 150);
    expect(s.level).toBe("ok");
    expect(s.percent).toBe(7);
  });

  it("reports ok with zero usage", () => {
    const s = computeBandwidthStatus(0, 5);
    expect(s.level).toBe("ok");
    expect(s.percent).toBe(0);
  });

  it("warns at 80% of the limit", () => {
    const s = computeBandwidthStatus(4 * GB, 5);
    expect(s.level).toBe("warning");
    expect(s.percent).toBe(80);
  });

  it("stays ok just below the warning threshold", () => {
    const s = computeBandwidthStatus(Math.round(3.9 * GB), 5);
    expect(s.level).toBe("ok");
  });

  it("reports over at exactly the limit", () => {
    const s = computeBandwidthStatus(5 * GB, 5);
    expect(s.level).toBe("over");
    expect(s.percent).toBe(100);
  });

  it("reports over past the limit", () => {
    const s = computeBandwidthStatus(12 * GB, 5);
    expect(s.level).toBe("over");
    expect(s.percent).toBe(240);
  });
});
