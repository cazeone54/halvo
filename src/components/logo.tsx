import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/site";

// The compact mark — a simple, grid-based "H" monogram in teal, no container.
// Follows current best practice: the logo is wordmark-primary (see Logo below),
// with a minimal geometric icon kept only for favicon / tight-space use.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={BRAND_NAME}>
      <defs>
        <linearGradient id="halvo-mark-teal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2bbfbf" />
          <stop offset="1" stopColor="#0f6163" />
        </linearGradient>
      </defs>
      <rect x="18" y="14" width="16" height="72" rx="6" fill="url(#halvo-mark-teal)" />
      <rect x="66" y="14" width="16" height="72" rx="6" fill="url(#halvo-mark-teal)" />
      <rect x="30" y="42" width="40" height="16" rx="5" fill="url(#halvo-mark-teal)" />
    </svg>
  );
}

// Primary logo — a wordmark, which is 2026's dominant and most durable logo
// form (more memorable + scalable than a busy mark, and it ages better). Set in
// Manrope, extra-bold, tightly tracked; the leading "H" carries the brand teal
// (a restrained "warm-minimalist" accent) while the rest stays high-contrast in
// both light and dark. `markClassName` is accepted for call-site compatibility.
export function Logo({ className }: { className?: string; markClassName?: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.04em]",
        className,
      )}
    >
      <span className="text-primary">H</span>alvo
    </span>
  );
}
