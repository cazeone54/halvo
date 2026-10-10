import type { Block, Inline } from "@/lib/lesson-reader";

// Renders parsed course content as React elements. Every piece of seller text
// lands as a text node, so nothing in an uploaded file can become markup.

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case "text":
            return <span key={i}>{node.text}</span>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-foreground">
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <InlineNodes nodes={node.children} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
                {node.text}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={node.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                <InlineNodes nodes={node.children} />
              </a>
            );
        }
      })}
    </>
  );
}

const headingClass: Record<number, string> = {
  1: "text-2xl",
  2: "text-xl",
  3: "text-lg",
  4: "text-base",
  5: "text-base",
  6: "text-base",
};

export function LessonContent({ blocks, parseInline }: { blocks: Block[]; parseInline: (text: string) => Inline[] }) {
  return (
    <div className="flex flex-col gap-4 text-[1.0625rem] leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            // Lesson titles are h2 on the page, so content headings start at h3.
            const Tag = `h${Math.min(6, Math.max(3, block.level + 1))}` as "h3" | "h4" | "h5" | "h6";
            return (
              <Tag
                key={i}
                className={`mt-2 font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground ${
                  headingClass[block.level] ?? "text-base"
                }`}
              >
                <InlineNodes nodes={parseInline(block.text)} />
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={i}>
                <InlineNodes nodes={parseInline(block.text)} />
              </p>
            );
          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag key={i} className={`flex flex-col gap-1.5 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <InlineNodes nodes={parseInline(item)} />
                  </li>
                ))}
              </ListTag>
            );
          }
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm leading-normal">
                <code>{block.text}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-primary/40 pl-4 text-muted-foreground">
                <InlineNodes nodes={parseInline(block.text)} />
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {block.header.map((cell, j) => (
                        <th key={j} scope="col" className="border-b px-3 py-2 font-semibold">
                          <InlineNodes nodes={parseInline(cell)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b last:border-0">
                        {block.header.map((_, c) => (
                          <td key={c} className="px-3 py-2 align-top">
                            <InlineNodes nodes={parseInline(row[c] ?? "")} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="my-2 border-border" />;
        }
      })}
    </div>
  );
}
