import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Every image (product cover, avatar) lives in the same private
// `digital-assets` bucket as downloadable files, so display always needs a
// signed URL — there's no public bucket to fall back on.
export async function signImagePath(
  supabase: SupabaseClient<Database>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("digital-assets").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
