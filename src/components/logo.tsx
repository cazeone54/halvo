import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/site";

// The Halvo mark — the rounded teal tile with a bold "slab" H: heavier, flatter
// posts and a solid crossbar, for a serious, payments-grade feel. Refined teal
// gradient for more depth/contrast.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={BRAND_NAME}>
      <defs>
        <linearGradient id="halvo-mark-teal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2bbfbf" />
          <stop offset="1" stopColor="#0f6163" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="24" fill="url(#halvo-mark-teal)" />
      <rect x="24" y="24" width="15" height="52" rx="4" fill="#fff" />
      <rect x="61" y="24" width="15" height="52" rx="4" fill="#fff" />
      <rect x="39" y="42" width="22" height="16" rx="3" fill="#fff" />
    </svg>
  );
}

// Mark + wordmark lockup. Use `markClassName` to size the mark; the wordmark
// tracks the display font already loaded by the app.
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("h-7 w-7", markClassName)} />
      <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">{BRAND_NAME}</span>
    </span>
  );
}
