import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT_EXAMPLES, type ProductExample } from "@/lib/product-examples";

// A new seller's first view of their product list. One primary action, plus
// examples that pre-fill the form — the empty state is the first impression,
// so it should show what "good" looks like rather than only announce absence.
export function ProductsEmptyState({
  onCreate,
  onUseExample,
}: {
  onCreate: () => void;
  onUseExample: (example: ProductExample) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Package className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="max-w-sm">
        <p className="font-[family-name:var(--font-display)] text-base font-semibold">Your first product goes here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a file, set a price, and you get a link you can share anywhere. Most sellers are live in a few
          minutes.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> Create your first product
      </Button>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground">Or start from an example and make it yours:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {PRODUCT_EXAMPLES.map((example) => (
            <Button key={example.key} variant="outline" size="sm" onClick={() => onUseExample(example)}>
              {example.label}
              <span className="text-muted-foreground">{Number(example.price) === 0 ? "free" : `$${example.price}`}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
