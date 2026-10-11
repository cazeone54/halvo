import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// Collapsed by default so a first-time seller sees only what they need to
// publish. Opens on its own when a product already uses one of the options
// inside, so a setting someone chose is never silently tucked out of sight.
export function AdvancedOptions({
  children,
  activeSummary,
  defaultOpen = false,
}: {
  children: ReactNode;
  activeSummary?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="group rounded-lg border"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          Advanced options
        </span>
        <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
          {activeSummary || "License keys"}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t p-3">{children}</div>
    </details>
  );
}
