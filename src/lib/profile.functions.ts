import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, handle, display_name")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return data;
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
