import { describe, expect, it } from "vitest";
import {
  READABLE_MAX_BYTES,
  isReadableOnline,
  parseInline,
  parseMarkdown,
  progressSummary,
  safeHref,
  splitIntoLessons,
} from "./lesson-reader";

describe("isReadableOnline", () => {
  it("accepts markdown files within the size cap", () => {
    expect(isReadableOnline({ fileName: "course-1.md", sizeBytes: 5000 })).toBe(true);
    expect(isReadableOnline({ fileName: "Guide.MARKDOWN", sizeBytes: 10 })).toBe(true);
  });
  it("rejects other types, oversized files and missing names", () => {
    expect(isReadableOnline({ fileName: "book.pdf", sizeBytes: 10 })).toBe(false);
    expect(isReadableOnline({ fileName: "huge.md", sizeBytes: READABLE_MAX_BYTES + 1 })).toBe(false);
    expect(isReadableOnline({ fileName: null, sizeBytes: 10 })).toBe(false);
  });
});

describe("safeHref", () => {
  it("allows http(s) and mailto only", () => {
    expect(safeHref("https://halvo.io")).toBe("https://halvo.io");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses code, bold, italic and links", () => {
    expect(parseInline("call `.update()` and **check** it, see [docs](https://x.io) *now*")).toEqual([
      { type: "text", text: "call " },
      { type: "code", text: ".update()" },
      { type: "text", text: " and " },
      { type: "strong", children: [{ type: "text", text: "check" }] },
      { type: "text", text: " it, see " },
      { type: "link", href: "https://x.io", children: [{ type: "text", text: "docs" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "now" }] },
    ]);
  });

  it("renders an unsafe link as its plain text, never as a link", () => {
    expect(parseInline("[click](javascript:alert(1))")).toEqual([{ type: "text", text: "click" }]);
  });

  it("keeps balanced parentheses inside a link URL", () => {
    expect(parseInline("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))")).toEqual([
      { type: "link", href: "https://en.wikipedia.org/wiki/Foo_(bar)", children: [{ type: "text", text: "wiki" }] },
    ]);
  });

  it("leaves markup characters as literal text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ type: "text", text: "<script>alert(1)</script>" }]);
  });
});

describe("parseMarkdown", () => {
  it("parses headings, paragraphs joined across lines, and hr", () => {
    expect(parseMarkdown("# Title\n\nline one\nline two\n\n---\n## Next")).toEqual([
      { type: "heading", level: 1, text: "Title" },
      { type: "paragraph", text: "line one line two" },
      { type: "hr" },
      { type: "heading", level: 2, text: "Next" },
    ]);
  });

  it("parses ordered and unordered lists", () => {
    expect(parseMarkdown("- a\n- b\n\n1. one\n2. two")).toEqual([
      { type: "list", ordered: false, items: ["a", "b"] },
      { type: "list", ordered: true, items: ["one", "two"] },
    ]);
  });

  it("keeps fenced code verbatim, including markdown inside it", () => {
    expect(parseMarkdown("```\n# not a heading\n**raw**\n```")).toEqual([
      { type: "code", text: "# not a heading\n**raw**" },
    ]);
  });

  it("parses a pipe table with header and rows", () => {
    expect(parseMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |\n| | |")).toEqual([
      { type: "table", header: ["A", "B"], rows: [["1", "2"], ["", ""]] },
    ]);
  });

  it("parses blockquotes and handles CRLF line endings", () => {
    expect(parseMarkdown("> quoted\r\n> more\r\n\r\nafter")).toEqual([
      { type: "quote", text: "quoted more" },
      { type: "paragraph", text: "after" },
    ]);
  });
});

describe("splitIntoLessons", () => {
  it("takes the h1 as the title, text before the first h2 as intro, one lesson per h2", () => {
    const course = splitIntoLessons(parseMarkdown("# Course\n\nWelcome.\n\n## Module 1\n\nA\n\n## Module 2\n\nB"));
    expect(course.title).toBe("Course");
    expect(course.intro).toEqual([{ type: "paragraph", text: "Welcome." }]);
    expect(course.lessons.map((l) => [l.key, l.title])).toEqual([
      ["0-module-1", "Module 1"],
      ["1-module-2", "Module 2"],
    ]);
    expect(course.lessons[1].blocks).toEqual([{ type: "paragraph", text: "B" }]);
  });

  it("treats a file with no h2 as a single lesson so any markdown opens", () => {
    const course = splitIntoLessons(parseMarkdown("# Notes\n\njust text"));
    expect(course.lessons).toHaveLength(1);
    expect(course.lessons[0].title).toBe("Notes");
    expect(course.lessons[0].blocks).toEqual([{ type: "paragraph", text: "just text" }]);
  });
});

describe("progressSummary", () => {
  it("counts done, percent and the first incomplete lesson", () => {
    expect(progressSummary(["a", "b", "c"], new Set(["a"]))).toEqual({
      done: 1,
      total: 3,
      percent: 33,
      firstIncomplete: 1,
    });
  });
  it("ignores stale keys from an older version of the file", () => {
    expect(progressSummary(["a", "b"], new Set(["a", "b", "old-key"])).done).toBe(2);
  });
  it("reports null when everything is complete", () => {
    expect(progressSummary(["a"], new Set(["a"])).firstIncomplete).toBeNull();
  });
});
