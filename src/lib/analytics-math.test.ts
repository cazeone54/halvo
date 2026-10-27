import { describe, expect, it } from "vitest";
import { pctChange, periodWindow, revenueBuckets, sourceLabel, stableTopKeys, toSlices } from "./analytics-math";

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

describe("slices for a circle chart", () => {
  const allTime = new Map([
    ["Instagram", 500],
    ["Direct", 300],
    ["TikTok", 200],
    ["Email", 100],
    ["Reddit", 5],
  ]);
  const stable = stableTopKeys(allTime);

  it("keeps each colour with the same source whatever this period's ranking", () => {
    expect(stable).toEqual(["Instagram", "Direct", "TikTok", "Email"]);
    // This week TikTok beat Instagram — it still keeps its own colour slot.
    const week = toSlices(new Map([["TikTok", 40], ["Instagram", 10]]), stable);
    expect(week.slices.map((s) => [s.key, s.slot])).toEqual([
      ["Instagram", 1],
      ["TikTok", 3],
    ]);
  });

  it("folds everything else into Other and adds up to the whole", () => {
    const { slices, total } = toSlices(new Map([["Instagram", 6], ["Reddit", 3], ["Unknown", 1]]), stable);
    expect(total).toBe(10);
    expect(slices).toEqual([
      { key: "Instagram", value: 6, share: 0.6, slot: 1 },
      { key: "Other", value: 4, share: 0.4, slot: 0 },
    ]);
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
  });

  it("draws nothing for an empty period", () => {
    expect(toSlices(new Map(), stable)).toEqual({ slices: [], total: 0 });
  });
});

describe("revenueBuckets", () => {
  const days = [
    { day: "2026-10-27", revenueCents: 500 },
    { day: "2026-10-21", revenueCents: 300 },
    { day: "2026-08-02", revenueCents: 1000 },
  ];

  it("a bar per day for 7 and 30 days, ending today", () => {
    const b = revenueBuckets(days, 7, now);
    expect(b).toHaveLength(7);
    expect(b[6]).toMatchObject({ key: "2026-10-27", cents: 500 });
    expect(b[0].key).toBe("2026-10-21");
    expect(b[0].cents).toBe(300);
    expect(revenueBuckets(days, 30, now)).toHaveLength(30);
  });

  it("a bar per week for 90 days, without losing any money", () => {
    const b = revenueBuckets(days, 90, now);
    expect(b).toHaveLength(13);
    expect(b.reduce((a, x) => a + x.cents, 0)).toBe(1800);
    expect(b[12].cents).toBe(800); // the last week holds both October sales
  });

  it("a bar per month for all time, last twelve months", () => {
    const b = revenueBuckets(days, 0, now);
    expect(b).toHaveLength(12);
    expect(b[11]).toMatchObject({ key: "2026-10", cents: 800 });
    expect(b[9]).toMatchObject({ key: "2026-08", cents: 1000 });
  });
});
