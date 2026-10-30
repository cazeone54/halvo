// Shared content block format for guides and blog posts. Structured and typed
// rather than markdown, so it needs no extra build pipeline and malformed
// content fails at compile time instead of rendering badly in production.
export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "ul"; items: string[] }
  | { type: "note"; text: string }
  | { type: "code"; code: string }
  | { type: "pricing" }
  // A screenshot from public/screens, at its real pixel size so the page
  // doesn't jump while it loads. `narrow` for a small picture (a single card)
  // that would look blown up across the whole column.
  | { type: "image"; src: string; alt: string; width: number; height: number; caption?: string; narrow?: boolean };
