import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { avatarImageUrl } from "@/lib/public-image-url";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "id, handle, display_name, bio, support_email, refund_policy, avatar_url, thank_you_message, thank_you_redirect_url",
      )
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return { ...data, avatarUrl: avatarImageUrl(data.id, data.avatar_url) };
  });

const HANDLE_RE = /^[a-z0-9_-]{3,32}$/;

export const updateMyHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ handle: z.string().trim().toLowerCase() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!HANDLE_RE.test(data.handle)) {
      throw new Error("Handle must be 3-32 characters: lowercase letters, numbers, - or _.");
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ handle: data.handle })
      .eq("id", context.userId);
    if (error) {
      if (error.code === "23505") throw new Error("That handle is already taken.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        displayName: z.string().trim().max(80).optional(),
        bio: z.string().trim().max(280).optional(),
        supportEmail: z.string().trim().email().optional().or(z.literal("")),
        refundPolicy: z.string().trim().max(500).optional(),
        thankYouMessage: z.string().trim().max(500).optional(),
        // Restricted to http(s) so the value can be rendered as a link on the
        // buyer's download page without a javascript:/data: scheme sneaking in.
        thankYouRedirectUrl: z
          .string()
          .trim()
          .max(500)
          .regex(/^https?:\/\/.+/i, "Use a full link starting with http:// or https://")
          .optional()
          .or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName ?? null,
        bio: data.bio ?? null,
        support_email: data.supportEmail || null,
        refund_policy: data.refundPolicy ?? null,
        thank_you_message: data.thankYouMessage ?? null,
        thank_you_redirect_url: data.thankYouRedirectUrl || null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const MAX_AVATAR_MB = 3;

export const setMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        storageFilePath: z.string().min(1),
        sizeBytes: z.number().int().positive().max(MAX_AVATAR_MB * 1024 * 1024),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", context.userId)
      .single();

    const { error } = await context.supabase
      .from("profiles")
      .update({ avatar_url: data.storageFilePath })
      .eq("id", context.userId);
    if (error) {
      await context.supabase.storage.from("digital-assets").remove([data.storageFilePath]);
      throw new Error(error.message);
    }

    if (existing?.avatar_url) {
      await context.supabase.storage.from("digital-assets").remove([existing.avatar_url]);
    }
    return { ok: true };
  });
