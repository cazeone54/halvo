import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bannerImageUrl } from "@/lib/public-image-url";
import { isOwnStoredImage } from "@/lib/avatar";
import { MAX_BANNER_MB, normalizeAnnouncement } from "@/lib/shop-look";

const BUCKET = "digital-assets";

// Before migration 0030 is applied the columns don't exist, or exist without
// their grants. Either way the feature just isn't available yet — Settings
// must keep working.
function notMigrated(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "42501" ||
    /schema cache|column .* does not exist|permission denied/i.test(error.message)
  );
}

const NOT_YET = "This isn't switched on yet. Please try again a little later.";

export const getMyShopLook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("banner_path, announcement_text, announcement_url")
      .eq("id", context.userId)
      .single();
    if (error) {
      if (notMigrated(error)) {
        return { available: false as const, bannerUrl: null, announcementText: "", announcementUrl: "" };
      }
      throw new Error(error.message);
    }
    return {
      available: true as const,
      bannerUrl: bannerImageUrl(context.userId, data.banner_path),
      announcementText: data.announcement_text ?? "",
      announcementUrl: data.announcement_url ?? "",
    };
  });

export const updateMyAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ text: z.string().max(1000), url: z.string().max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const announcement = normalizeAnnouncement(data);
    if (!announcement.ok) throw new Error(announcement.error);
    const { error } = await context.supabase
      .from("profiles")
      .update({
        announcement_text: announcement.value?.text ?? null,
        announcement_url: announcement.value?.url ?? null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(notMigrated(error) ? NOT_YET : error.message);
    return { ok: true, announcement: announcement.value };
  });

// The picture is uploaded straight to storage from the browser, then named
// here. Its size and type are read back from storage rather than taken from
// the browser's word: the banner is served publicly, so it must not become a
// way to host a large file for free.
export const setMyBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ storageFilePath: z.string().min(1).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const path = data.storageFilePath;
    if (!isOwnStoredImage(path, context.userId, "banner")) throw new Error("Invalid image path");

    const folder = `${context.userId}/banner`;
    const name = path.slice(folder.length + 1);
    const { data: listed } = await context.supabase.storage.from(BUCKET).list(folder, { search: name, limit: 20 });
    const stored = listed?.find((o) => o.name === name);
    if (!stored) throw new Error("Couldn't find the uploaded picture. Please try again.");
    const size = Number(stored.metadata?.size ?? 0);
    const type = String(stored.metadata?.mimetype ?? "");
    if (!type.startsWith("image/") || size > MAX_BANNER_MB * 1024 * 1024) {
      await context.supabase.storage.from(BUCKET).remove([path]);
      throw new Error(`Use a JPG, PNG or WebP picture up to ${MAX_BANNER_MB} MB.`);
    }

    const { data: existing } = await context.supabase
      .from("profiles")
      .select("banner_path")
      .eq("id", context.userId)
      .single();
    const { error } = await context.supabase.from("profiles").update({ banner_path: path }).eq("id", context.userId);
    if (error) {
      await context.supabase.storage.from(BUCKET).remove([path]);
      throw new Error(notMigrated(error) ? NOT_YET : error.message);
    }
    const old = existing?.banner_path;
    if (old && old !== path && isOwnStoredImage(old, context.userId, "banner")) {
      await context.supabase.storage.from(BUCKET).remove([old]);
    }
    return { ok: true };
  });

export const removeMyBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing, error: readError } = await context.supabase
      .from("profiles")
      .select("banner_path")
      .eq("id", context.userId)
      .single();
    if (readError) throw new Error(notMigrated(readError) ? NOT_YET : readError.message);
    const { error } = await context.supabase.from("profiles").update({ banner_path: null }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    const old = existing?.banner_path;
    if (isOwnStoredImage(old, context.userId, "banner")) await context.supabase.storage.from(BUCKET).remove([old]);
    return { ok: true };
  });
