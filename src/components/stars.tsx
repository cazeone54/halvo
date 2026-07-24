import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Renders a rating as stars, supporting halves so a 4.6 average doesn't display
// as five full stars. Purely presentational.
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i;
        const half = !filled && value >= i - 0.5;
        return (
          <span key={i} className="relative inline-block">
            <Star className="h-3.5 w-3.5 text-muted-foreground/30" />
            {filled || half ? (
              <span
                className="absolute inset-0 overflow-hidden"
                style={half ? { width: "50%" } : undefined}
              >
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

// Star picker for leaving a review.
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          onClick={() => onChange(i)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn("h-6 w-6", value >= i ? "fill-primary text-primary" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}
