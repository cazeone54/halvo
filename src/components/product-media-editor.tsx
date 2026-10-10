import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CircleCheck, ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addGalleryImage, removeGalleryImage, setProductVideo } from "@/lib/product-media.functions";
import { MAX_GALLERY_IMAGES, galleryImageUrls, parseVideoUrl } from "@/lib/product-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Saves immediately (like the cover image), separate from the text fields'
// Save button — an uploaded image shouldn't sit waiting on another click.
export function ProductMediaEditor({
  productId,
  videoUrl,
  galleryPaths,
}: {
  productId: string;
  videoUrl: string | null;
  galleryPaths: string[];
}) {
  const qc = useQueryClient();
  const setVideoFn = useServerFn(setProductVideo);
  const addFn = useServerFn(addGalleryImage);
  const removeFn = useServerFn(removeGalleryImage);
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-products"] });

  const [video, setVideo] = useState(videoUrl ?? "");
  const trimmed = video.trim();
  const parsed = parseVideoUrl(trimmed);
  const videoInvalid = trimmed !== "" && !parsed;
  const videoDirty = trimmed !== (videoUrl ?? "");

  const videoMut = useMutation({
    mutationFn: (url: string) => setVideoFn({ data: { productId, url } }),
    onSuccess: (_r, url) => {
      toast.success(url ? "Preview video saved." : "Preview video removed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMut = useMutation({
    mutationFn: async (files: File[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      // Sequential so the server's 6-image cap is checked against each one in turn.
      for (const file of files) {
        const path = `${user.id}/${productId}/gallery-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("digital-assets").upload(path, file);
        if (error) throw error;
        await addFn({ data: { productId, storageFilePath: path, sizeBytes: file.size } });
      }
      return files.length;
    },
    onSuccess: (n) => toast.success(n === 1 ? "Image added." : `${n} images added.`),
    onError: (e: Error) => toast.error(e.message),
    onSettled: refresh,
  });

  const removeMut = useMutation({
    mutationFn: (index: number) => removeFn({ data: { productId, index } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const urls = galleryImageUrls(productId, galleryPaths);
  const slotsLeft = MAX_GALLERY_IMAGES - galleryPaths.length;
  const busy = addMut.isPending || removeMut.isPending;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed p-3">
      <div>
        <p className="text-sm font-medium">Product page media</p>
        <p className="text-xs text-muted-foreground">
          Show buyers what they get — a short video or a few screenshots answers their questions before they ask.
        </p>
      </div>

      <div>
        <Label htmlFor={`video-${productId}`}>Preview video</Label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <Input
            id={`video-${productId}`}
            type="url"
            inputMode="url"
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            placeholder="YouTube, Vimeo or Loom link"
            aria-invalid={videoInvalid}
            aria-describedby={`video-help-${productId}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="sm:h-9"
            disabled={!videoDirty || videoInvalid || videoMut.isPending}
            onClick={() => videoMut.mutate(trimmed)}
          >
            {trimmed === "" && videoUrl ? "Remove" : "Save video"}
          </Button>
        </div>
        <p id={`video-help-${productId}`} className="mt-1 flex items-center gap-1 text-xs">
          {videoInvalid ? (
            <span className="text-destructive">That link isn't a YouTube, Vimeo or Loom video.</span>
          ) : parsed ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CircleCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {parsed.provider} video — plays
              on your product page when a buyer taps it.
            </span>
          ) : (
            <span className="text-muted-foreground">A 1–2 minute walkthrough is plenty.</span>
          )}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium">
          Gallery <span className="font-normal text-muted-foreground">({galleryPaths.length}/{MAX_GALLERY_IMAGES})</span>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {urls.map((src, i) => (
            <div key={src} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
              <img src={src} alt={`Gallery image ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeMut.mutate(i)}
                disabled={busy}
                aria-label={`Remove gallery image ${i + 1}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow-sm transition-opacity hover:bg-background focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {slotsLeft > 0 ? (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-within:outline-2 focus-within:outline-ring">
              {addMut.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="text-xs">{addMut.isPending ? "Uploading…" : "Add"}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Add gallery images"
                disabled={busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).slice(0, slotsLeft);
                  if (files.length) addMut.mutate(files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Screenshots, page spreads, before/after — up to 5 MB each.</p>
      </div>
    </div>
  );
}
