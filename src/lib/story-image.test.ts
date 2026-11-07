import { describe, expect, it } from "vitest";
import { displayLink, wrapLines } from "./story-image";

// One unit per character, so widths are easy to reason about.
const measure = (s: string) => s.length;

describe("wrapLines", () => {
  it("fills each line as far as it fits", () => {
    expect(wrapLines(measure, "Freelance Client Tracker Notion Template", 20, 3)).toEqual([
      "Freelance Client",
      "Tracker Notion",
      "Template",
    ]);
  });

  it("ends with … when the name runs past the last line", () => {
    const lines = wrapLines(measure, "one two three four five six seven", 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("one two");
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
  });

  it("cuts a single word too long for any line", () => {
    const [line] = wrapLines(measure, "Supercalifragilistic", 8, 2);
    expect(line).toBe("Superca…");
  });

  it("draws nothing for an empty name", () => {
    expect(wrapLines(measure, "   ", 10, 3)).toEqual([]);
  });
});

describe("displayLink", () => {
  it("drops the scheme so the address is short enough to read", () => {
    expect(displayLink("https://halvo.io/p/sourdough-a1b2c3")).toBe("halvo.io/p/sourdough-a1b2c3");
    expect(displayLink("https://www.halvo.io/p/x")).toBe("halvo.io/p/x");
  });
});
