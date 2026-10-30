import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyShopLook, removeMyBanner, setMyBanner, updateMyAnnouncement } from "@/lib/shop-look.functions";
import { MAX_ANNOUNCEMENT, MAX_BANNER_MB } from "@/lib/shop-look";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Settings card for how the shop page looks beyond name and colour: a banner
// picture across the top, and a one-line announcement above everything.
export function ShopLookEditor() {
  const uid = useId();
  const qc = useQueryClient();
  const lookFn = useServerFn(getMyShopLook);
  const setBannerFn = useServerFn(setMyBanner);
  const removeBannerFn = useServerFn(removeMyBanner);
  const saveAnnouncementFn = useServerFn(updateMyAnnouncement);

  const lookQ = useQuery({ queryKey: ["my-shop-look"], queryFn: () => lookFn() });

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  // Fill once, like the rest of Settings: a refetch must not wipe unsaved edits.
  const filled = useRef(false);
  useEffect(() => {
    if (!lookQ.data || filled.current) return;
    filled.current = true;
    setText(lookQ.data.announcementText);
    setUrl(lookQ.data.announcementUrl);
  }, [lookQ.data]);

  const bannerMut = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Pick a picture: JPG, PNG or WebP.");
      if (file.size > MAX_BANNER_MB * 1024 * 1024) throw new Error(`Pick a picture up to ${MAX_BANNER_MB} MB.`);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      // Storage refuses some characters in names; the timestamp keeps it unique.
      const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const path = `${user.id}/banner/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("digital-assets").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await setBannerFn({ data: { storageFilePath: path } });
    },
    onSuccess: () => {
      toast.success("Banner updated.");
      qc.invalidateQueries({ queryKey: ["my-shop-look"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => removeBannerFn(),
    onSuccess: () => {
      toast.success("Banner removed.");
      qc.invalidateQueries({ queryKey: ["my-shop-look"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => saveAnnouncementFn({ data: { text, url } }),
    onSuccess: (res) => {
      setText(res.announcement?.text ?? "");
      setUrl(res.announcement?.url ?? "");
      toast.success(res.announcement ? "Announcement is live on your shop." : "Announcement removed.");
      qc.invalidateQueries({ queryKey: ["my-shop-look"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bannerUrl = lookQ.data?.bannerUrl ?? null;
  const busy = bannerMut.isPending || removeMut.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shop look</CardTitle>
        <p className="text-sm text-muted-foreground">
          A banner across the top of your shop, and a line for news or a sale.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {lookQ.data?.available === false ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            This is being switched on. Check back a little later.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Banner</p>
              <div className="relative aspect-[4/1] w-full overflow-hidden rounded-lg border bg-muted">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Your shop banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    No banner yet
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`${uid}-banner`} className={busy ? "pointer-events-none opacity-60" : "cursor-pointer"}>
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-accent">
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    {bannerMut.isPending ? "Uploading…" : bannerUrl ? "Change banner" : "Upload banner"}
                  </span>
                </Label>
                <input
                  id={`${uid}-banner`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) bannerMut.mutate(file);
                    e.target.value = "";
                  }}
                />
                {bannerUrl ? (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => removeMut.mutate()}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                A wide picture works best, about 1600 × 400. JPG, PNG or WebP, up to {MAX_BANNER_MB} MB.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor={`${uid}-text`}>Announcement</Label>
                <Input
                  id={`${uid}-text`}
                  value={text}
                  maxLength={MAX_ANNOUNCEMENT}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="New course out Friday · 20% off this week"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A line across the very top of your shop. Leave it empty to hide it. {text.length}/{MAX_ANNOUNCEMENT}
                </p>
              </div>
              <div>
                <Label htmlFor={`${uid}-url`}>Link (optional)</Label>
                <Input
                  id={`${uid}-url`}
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="halvo.io/p/your-product"
                />
              </div>
              <Button className="self-start" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : "Save announcement"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
