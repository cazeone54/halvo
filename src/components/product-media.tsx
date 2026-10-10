import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { MediaItem } from "@/lib/product-media";
import { cn } from "@/lib/utils";

// The product page's media stage: cover, preview video and gallery, with a
// thumbnail strip when there's more than one. The video is a click-to-play
// facade, so no third-party player (or its tracking) loads until the buyer
// actually asks for it.
export function ProductMedia({ items }: { items: MediaItem[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)];
  const many = items.length > 1;

  const select = (i: number, focusThumb = false) => {
    const next = (i + items.length) % items.length;
    setIndex(next);
    setPlaying(false);
    if (focusThumb) thumbRefs.current[next]?.focus();
  };

  const onThumbKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") select(index + 1, true);
    else if (e.key === "ArrowLeft") select(index - 1, true);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div className="group relative aspect-video w-full overflow-hidden bg-muted">
        {current.kind === "image" ? (
          <img
            src={current.src}
            alt={current.alt}
            className={cn("h-full w-full", index === 0 ? "object-cover" : "object-contain")}
          />
        ) : playing ? (
          <iframe
            src={current.video.embedUrl}
            title={`Product preview video (${current.video.provider})`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-hero-glow text-foreground focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
              <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">Play preview</span>
            <span className="text-xs text-muted-foreground">Loads a {current.video.provider} video</span>
          </button>
        )}

        {many && !(current.kind === "video" && playing) ? (
          <>
            <button
              type="button"
              onClick={() => select(index - 1)}
              aria-label="Previous"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => select(index + 1)}
              aria-label="Next"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {many ? (
        <div className="flex gap-2 overflow-x-auto border-b px-3 py-2.5" role="group" aria-label="Product media">
          {items.map((item, i) => (
            <button
              key={i}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              type="button"
              onClick={() => select(i)}
              onKeyDown={onThumbKey}
              aria-label={item.kind === "video" ? "Preview video" : `Image ${i + 1} of ${items.length}`}
              aria-current={i === index ? "true" : undefined}
              tabIndex={i === index ? 0 : -1}
              className={cn(
                "relative h-12 w-16 shrink-0 overflow-hidden rounded-md border bg-muted transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                i === index ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
              )}
            >
              {item.kind === "image" ? (
                <img src={item.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-hero-glow text-primary">
                  <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
