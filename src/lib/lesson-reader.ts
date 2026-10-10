// Pure logic behind the online course reader: which files can be read in the
// browser, a small Markdown parser, splitting a course into lessons, and
// progress maths. The parser produces plain data (never HTML strings); the
// reader turns it into React elements, so a seller's file can't inject markup
// or script into a buyer's page.

export const READABLE_MAX_BYTES = 512 * 1024;

export function isReadableOnline(file: { fileName: string | null; sizeBytes: number | null }): boolean {
  if (!file.fileName || !/\.(md|markdown)$/i.test(file.fileName)) return false;
  return (file.sizeBytes ?? 0) <= READABLE_MAX_BYTES;
}

// --- Inline -------------------------------------------------------------------

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

// Only these schemes become links; anything else (javascript:, data:) stays text.
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : null;
}

// A link URL may contain one level of balanced parentheses (Wikipedia-style
// "/Foo_(bar)"), otherwise the first ")" would cut the URL short.
const LINK_URL = String.raw`(?:[^()\s]|\([^()\s]*\))+`;
const LINK = new RegExp(String.raw`^\[([^\]]+)\]\((${LINK_URL})\)$`);
const INLINE_PATTERN = new RegExp(
  String.raw`(\x60[^\x60]+\x60)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\(${LINK_URL}\))|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)`,
);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) out.push({ type: "text", text: rest.slice(0, match.index) });
    const token = match[0];
    if (match[1]) {
      out.push({ type: "code", text: token.slice(1, -1) });
    } else if (match[2]) {
      out.push({ type: "strong", children: parseInline(token.slice(2, -2)) });
    } else if (match[3]) {
      const linkMatch = LINK.exec(token);
      const href = linkMatch ? safeHref(linkMatch[2]) : null;
      if (linkMatch && href) out.push({ type: "link", href, children: parseInline(linkMatch[1]) });
      else out.push({ type: "text", text: linkMatch ? linkMatch[1] : token });
    } else {
      out.push({ type: "em", children: parseInline(token.slice(1, -1)) });
    }
    rest = rest.slice(match.index + token.length);
  }
  return out;
}

// --- Blocks -------------------------------------------------------------------

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const splitCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    line.trim().startsWith("```") ||
    HEADING.test(line) ||
    HR.test(line) ||
    /^\s*>/.test(line) ||
    UL.test(line) ||
    OL.test(line) ||
    (line.trim().startsWith("|") && next !== undefined && TABLE_SEPARATOR.test(next))
  );
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++; // closing fence (or end of file)
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", text: body.join(" ").trim() });
      continue;
    }

    if (line.trim().startsWith("|") && TABLE_SEPARATOR.test(lines[i + 1] ?? "")) {
      const header = splitCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitCells(lines[i++]));
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (UL.test(line) || OL.test(line)) {
      const ordered = !UL.test(line);
      const pattern = ordered ? OL : UL;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push((pattern.exec(lines[i++]) as RegExpExecArray)[1]);
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const body: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i], lines[i + 1])) {
      body.push(lines[i++].trim());
    }
    blocks.push({ type: "paragraph", text: body.join(" ") });
  }
  return blocks;
}

// --- Lessons ------------------------------------------------------------------

export type Lesson = { key: string; title: string; blocks: Block[] };
export type Course = { title: string | null; intro: Block[]; lessons: Lesson[] };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

// A course file reads as: an optional "# Title", an optional intro, then one
// lesson per "## " heading. A file with no "## " headings is a single lesson,
// so any markdown still opens cleanly. Lesson keys combine position and title,
// so saved progress survives the seller fixing a typo elsewhere in the file.
export function splitIntoLessons(blocks: readonly Block[]): Course {
  let title: string | null = null;
  const intro: Block[] = [];
  const lessons: Array<{ title: string; blocks: Block[] }> = [];
  let current: { title: string; blocks: Block[] } | null = null;

  for (const block of blocks) {
    if (block.type === "heading" && block.level === 1 && title === null && !current && intro.length === 0) {
      title = block.text;
      continue;
    }
    if (block.type === "heading" && block.level === 2) {
      current = { title: block.text, blocks: [] };
      lessons.push(current);
      continue;
    }
    (current ? current.blocks : intro).push(block);
  }

  if (lessons.length === 0) {
    return { title, intro: [], lessons: [{ key: `0-${slugify(title ?? "lesson")}`, title: title ?? "Lesson", blocks: intro }] };
  }
  return {
    title,
    intro,
    lessons: lessons.map((lesson, index) => ({ key: `${index}-${slugify(lesson.title)}`, ...lesson })),
  };
}

// --- Progress -----------------------------------------------------------------

export function progressSummary(
  lessonKeys: readonly string[],
  completed: ReadonlySet<string>,
): { done: number; total: number; percent: number; firstIncomplete: number | null } {
  const done = lessonKeys.filter((k) => completed.has(k)).length;
  const total = lessonKeys.length;
  const firstIncomplete = lessonKeys.findIndex((k) => !completed.has(k));
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    firstIncomplete: firstIncomplete === -1 ? null : firstIncomplete,
  };
}
