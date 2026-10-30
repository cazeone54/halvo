import { cn } from "@/lib/utils";

// A plain browser window around a real screenshot, so a picture of a page
// reads as a page someone could open, with its address on top.
export function BrowserFrame({
  url,
  children,
  className,
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-xl", className)}>
      <div className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="mx-auto min-w-0 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

// A screenshot from public/screens, at its real size so the page doesn't
// jump when it loads.
export function Screenshot({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={cn("block h-auto w-full", className)}
    />
  );
}
