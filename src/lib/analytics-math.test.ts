import { describe, expect, it } from "vitest";
import { bucketFinder, pctChange, periodWindow, sourceLabel, timeBuckets } from "./analytics-math";

const now = new Date("2026-10-27T15:00:00Z");

describe("periodWindow", () => {
  it("gives the period and the one before it", () => {
    const w = periodWindow(30, now);
    expect(w.since?.toISOString()).toBe("2026-09-27T15:00:00.000Z");
    expect(w.prevSince?.toISOString()).toBe("2026-08-28T15:00:00.000Z");
  });
  it("has nothing to compare with for all time", () => {
    expect(periodWindow(0, now)).toEqual({ since: null, prevSince: null });
  });
});

describe("pctChange", () => {
  it("compares with the previous period", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(100, 100)).toBe(0);
  });
  it("says nothing rather than 'up infinity' from zero", () => {
    expect(pctChange(10, 0)).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("puts every spelling of one place under one name", () => {
    for (const raw of ["instagram.com", "l.instagram.com", "IG", "instagram"]) expect(sourceLabel(raw)).toBe("Instagram");
    for (const raw of ["facebook.com", "fb", "meta"]) expect(sourceLabel(raw)).toBe("Facebook");
    for (const raw of ["google", "bing.com"]) expect(sourceLabel(raw)).toBe("Search engines");
    expect(sourceLabel("Direct")).toBe("Direct");
    expect(sourceLabel(null)).toBe("Unknown");
    expect(sourceLabel("www.someblog.com")).toBe("someblog.com");
  });
});

describe("chart bars", () => {
  it("a bar per day for 7 and 30 days, ending today", () => {
    const b = timeBuckets(7, now);
    expect(b).toHaveLength(7);
    expect(b[0]).toEqual({ key: "2026-10-21", start: "2026-10-21T00:00:00.000Z", unit: "day" });
    expect(b[6].key).toBe("2026-10-27");
    expect(timeBuckets(30, now)).toHaveLength(30);
    const find = bucketFinder(b);
    expect(find("2026-10-27T23:59:00+00:00")).toBe(6);
    expect(find("2026-10-21T00:00:00+00:00")).toBe(0);
    expect(find("2026-10-20T23:59:00+00:00")).toBe(-1);
  });

  it("a bar per week for 90 days, every day landing in exactly one week", () => {
    const b = timeBuckets(90, now);
    expect(b).toHaveLength(13);
    expect(b[12].key).toBe("2026-10-21"); // the last week ends today
    const find = bucketFinder(b);
    expect(find("2026-10-27T10:00:00Z")).toBe(12);
    expect(find("2026-10-20T10:00:00Z")).toBe(11);
    expect(find(`${b[0].key}T00:00:00Z`)).toBe(0);
    expect(find("2026-07-01T00:00:00Z")).toBe(-1);
  });

  it("a bar per month for all time, last twelve months", () => {
    const b = timeBuckets(0, now);
    expect(b).toHaveLength(12);
    expect(b[11].key).toBe("2026-10");
    expect(b[0].key).toBe("2025-11");
    const find = bucketFinder(b);
    expect(find("2026-08-02T12:00:00Z")).toBe(9);
    expect(find("2025-10-31T12:00:00Z")).toBe(-1);
  });
});
