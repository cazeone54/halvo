import * as React from "react";

import { cn } from "@/lib/utils";

// Mobile-keyboard defaults derived from the input `type`, so every field shows
// the right virtual keyboard and capitalization without each call site
// repeating it (email → email keyboard, no auto-caps; number → decimal keypad;
// etc.). Explicit `inputMode`/`autoCapitalize` props always win. The base
// `text-base` (16px) on mobile also prevents iOS's focus auto-zoom.
type InputMode = React.ComponentProps<"input">["inputMode"];
const TYPE_DEFAULTS: Record<string, { inputMode?: InputMode; autoCapitalize?: string }> = {
  email: { inputMode: "email", autoCapitalize: "none" },
  url: { inputMode: "url", autoCapitalize: "none" },
  tel: { inputMode: "tel" },
  search: { inputMode: "search" },
  number: { inputMode: "decimal" },
};

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, autoCapitalize, ...props }, ref) => {
    const defaults = type ? TYPE_DEFAULTS[type] : undefined;
    return (
      <input
        type={type}
        inputMode={inputMode ?? defaults?.inputMode}
        autoCapitalize={autoCapitalize ?? defaults?.autoCapitalize}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
