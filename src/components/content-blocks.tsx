import { PricingTiers } from "@/components/pricing-tiers";
import type { ContentBlock } from "@/content/blocks";

// Single renderer shared by guides and blog posts so long-form content looks
// identical everywhere and only has to be styled once.
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-10 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
          {block.text}
        </h2>
      );
    case "p":
      return <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{block.text}</p>;
    case "ul":
      return (
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed text-muted-foreground marker:font-semibold marker:text-primary">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "note":
      return (
        <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
          <p>{block.text}</p>
        </div>
      );
    case "code":
      // Copy-pasteable snippet (e.g. the embed button). break-all so a long
      // URL can't force the article to scroll sideways on a phone.
      return (
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">
          {block.code}
        </pre>
      );
    case "pricing":
      // Rendered from plans.ts so fee content can never drift from real rates.
      return (
        <div className="mt-6">
          <PricingTiers />
        </div>
      );
  }
}
