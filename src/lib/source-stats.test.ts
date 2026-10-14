import { describe, expect, it } from "vitest";
import { mergeSourceStats, UNKNOWN_SOURCE } from "./source-stats";

describe("mergeSourceStats", () => {
  it("combines views and sales for the same channel", () => {
    const stats = mergeSourceStats(
      ["instagram", "instagram", "google"],
      ["instagram"],
    );
    expect(stats).toEqual([
      { source: "instagram", views: 2, sales: 1 },
      { source: "google", views: 1, sales: 0 },
    ]);
  });

  it("produces the comparison the whole feature exists for", () => {
    // Sales-only data would rank instagram first and be read as "instagram is
    // my best channel". With views attached, the opposite is obvious.
    const stats = mergeSourceStats(
      [...Array(500).fill("instagram"), ...Array(40).fill("newsletter")],
      [...Array(2).fill("instagram"), ...Array(9).fill("newsletter")],
    );
    const ig = stats.find((s) => s.source === "instagram")!;
    const nl = stats.find((s) => s.source === "newsletter")!;

    expect(ig).toEqual({ source: "instagram", views: 500, sales: 2 });
    expect(nl).toEqual({ source: "newsletter", views: 40, sales: 9 });
    // Newsletter converts far better despite far less traffic, and sorts first.
    expect(nl.sales / nl.views).toBeGreaterThan(ig.sales / ig.views);
    expect(stats[0].source).toBe("newsletter");
  });

  it("reports unattributed views as Unknown, never as Direct", () => {
    // Views recorded before 0023 have a null source. Folding them into Direct
    // would silently overstate direct traffic.
    const stats = mergeSourceStats([null, undefined, "", "   ", "Direct"], []);
    expect(stats).toEqual([
      { source: UNKNOWN_SOURCE, views: 4, sales: 0 },
      { source: "Direct", views: 1, sales: 0 },
    ]);
  });

  it("keeps a channel that has sales but no recorded views", () => {
    // Otherwise this card's sales total wouldn't match the headline figure.
    const stats = mergeSourceStats(["google"], ["embed", "embed"]);
    expect(stats).toEqual([
      { source: "embed", views: 0, sales: 2 },
      { source: "google", views: 1, sales: 0 },
    ]);
  });

  it("sorts by sales, then views, then name", () => {
    const stats = mergeSourceStats(
      ["a", "a", "a", "b", "c"],
      ["b", "b", "c"],
    );
    expect(stats.map((s) => s.source)).toEqual(["b", "c", "a"]);
  });

  it("falls back to traffic volume before the first sale", () => {
    const stats = mergeSourceStats(["x", "y", "y", "z"], []);
    expect(stats.map((s) => s.source)).toEqual(["y", "x", "z"]);
  });

  it("totals match the inputs exactly", () => {
    const views = ["a", "b", null, "a", "c"];
    const sales = ["a", "d"];
    const stats = mergeSourceStats(views, sales);
    expect(stats.reduce((n, s) => n + s.views, 0)).toBe(views.length);
    expect(stats.reduce((n, s) => n + s.sales, 0)).toBe(sales.length);
  });

  it("handles empty input", () => {
    expect(mergeSourceStats([], [])).toEqual([]);
  });

  it("trims whitespace so one channel can't appear twice", () => {
    expect(mergeSourceStats([" instagram", "instagram "], [])).toEqual([
      { source: "instagram", views: 2, sales: 0 },
    ]);
  });
});
