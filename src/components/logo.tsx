import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/site";

// The Halvo mark — an H monogram whose crossbar rises to the right (a nod to a
// seller's sales climbing), in the app's teal. Scalable SVG; the gradient id is
// shared across instances on purpose (they all want the same fill).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={BRAND_NAME}>
      <defs>
        <linearGradient id="halvo-mark-teal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2bb6b6" />
          <stop offset="1" stopColor="#12676a" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="24" fill="url(#halvo-mark-teal)" />
      <rect x="28" y="26" width="12" height="48" rx="6" fill="#fff" />
      <rect x="60" y="26" width="12" height="48" rx="6" fill="#fff" />
      <path d="M34 57 L66 43" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}

// Mark + wordmark lockup. Use `markClassName` to size the mark; the wordmark
// tracks the display font already loaded by the app.
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("h-7 w-7", markClassName)} />
      <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
    </span>
  );
}
