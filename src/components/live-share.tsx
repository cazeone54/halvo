import { useState } from "react";
import { Copy, ExternalLink, ImageDown, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BASE_URL } from "@/lib/site";
import { buildProductLink } from "@/lib/share-snippets";
import { formatCents } from "@/lib/format";
import { displayLink, renderStoryImage } from "@/lib/story-image";

// What to do the moment a product goes live: the link, ready to copy or
// share, and a Story picture to post it with. Sharing is what makes the first
// sale, and before this a new seller got a small "you're live" pop-up and
// nothing to post.
export function LiveShare({
  product,
}: {
  product: { name: string; slug: string; priceCents: number; payWhatYouWant?: boolean | null; coverUrl?: string | null };
}) {
  const link = buildProductLink(BASE_URL, {
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    payWhatYouWant: product.payWhatYouWant ?? false,
  });
  const [making, setMaking] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy here — press and hold the link to copy it.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: product.name, url: link });
    } catch {
      // Closed the share sheet: nothing to say.
    }
  };

  // On a phone the picture goes straight into the share sheet (Instagram,
  // TikTok, WhatsApp…). Elsewhere it downloads.
  const story = async () => {
    setMaking(true);
    try {
      const blob = await renderStoryImage({
        name: product.name,
        priceLabel: product.payWhatYouWant
          ? "Name your price"
          : product.priceCents === 0
            ? "Free"
            : formatCents(product.priceCents).replace(/\.00$/, ""),
        link,
        coverUrl: product.coverUrl ?? null,
      });
      const file = new File([blob], `${product.slug}-story.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch {
          // Closed the share sheet.
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Story picture saved.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't make the picture.");
    } finally {
      setMaking(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={link}>
          {displayLink(link)}
        </span>
        <Button size="sm" onClick={copy} className="shrink-0">
          <Copy className="h-4 w-4" /> Copy link
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={story} disabled={making}>
          <ImageDown className="h-4 w-4" /> {making ? "Making it…" : "Story picture"}
        </Button>
        {canShare ? (
          <Button variant="outline" onClick={share}>
            <Share2 className="h-4 w-4" /> Share link
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> View your page
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Post the Story picture and add the link with Instagram's link sticker, or put the link in your bio. The first
        sale comes from people seeing it.
      </p>
    </div>
  );
}
