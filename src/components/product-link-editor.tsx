import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeProductLink, setProductLink } from "@/lib/product-links.functions";
import { normalizeDeliveryUrl } from "@/lib/product-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { cn } from "@/lib/utils";

// The link a buyer gets instead of a file — a Notion or Canva template, a
// Google Drive folder. Sits under the file list on a product card.
export function ProductLinkEditor({
  productId,
  link,
  primary,
  onPublished,
}: {
  productId: string;
  link: { url: string; label: string | null } | null;
  // No file and no link yet: this is one of the card's two main ways to
  // publish, so it reads as a real choice rather than small print.
  primary: boolean;
  onPublished: () => void;
}) {
  const qc = useQueryClient();
  const setFn = useServerFn(setProductLink);
  const removeFn = useServerFn(removeProductLink);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => setFn({ data: { productId, url } }),
    onSuccess: (res) => {
      setOpen(false);
      setUrl("");
      qc.invalidateQueries({ queryKey: ["my-products"] });
      if (res.published) onPublished();
      else toast.success("Link saved.");
    },
    onError: (e: Error) => setError(e.message),
  });
  const removeMut = useMutation({
    mutationFn: () => removeFn({ data: { productId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (link) {
    return (
      <div className="flex items-center justify-between gap-1 text-[13px]">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground" title={link.url}>
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{link.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
        </span>
        <span className="flex shrink-0 items-center">
          <Button asChild variant="ghost" size="icon-sm" title="Open the link buyers get">
            <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label="Open the link buyers get">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <ConfirmAction
            message="Remove this link? Buyers of this product will no longer be able to open it."
            confirmLabel="Remove"
            onConfirm={() => removeMut.mutate()}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Remove link" title="Remove link">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-md text-xs transition-colors",
          primary
            ? "self-center px-2 py-1 font-medium text-primary underline-offset-4 hover:underline"
            : "border border-dashed px-2.5 py-1 text-muted-foreground hover:border-primary hover:text-primary",
        )}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        {primary ? "Or paste a link instead (Notion, Canva, Drive…)" : "Add a link"}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-1.5 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        const checked = normalizeDeliveryUrl(url);
        if ("error" in checked) {
          setError(checked.error);
          return;
        }
        setError(null);
        saveMut.mutate();
      }}
    >
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://notion.so/… or canva.com/…"
          aria-label="Link buyers get"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" disabled={!url.trim() || saveMut.isPending} className="shrink-0">
          {saveMut.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} className="shrink-0">
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Buyers get it only after they pay or claim it. Make sure anyone with the link can open it.
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
