import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_BIO_LINKS,
  MAX_FEATURED,
  bioLinksForDisplay,
  normalizeBioLinks,
  normalizeSocialLinks,
  socialLinksForDisplay,
  type BioLink,
} from "@/lib/link-in-bio";

// Before migration 0028 is applied the columns don't exist, or exist without
// their grants. Either way the feature is simply not available yet — the
// settings page must keep working.
function linksNotMigrated(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    error.code === "42501" ||
    /schema cache|column .* does not exist|could not find the table|permission denied/i.test(error.message)
  );
}

const DAY = 24 * 60 * 60 * 1000;

type ClickCounts = Record<string, { total: number; last30: number }>;

export const getMyLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("social_links, bio_links, featured_product_ids")
      .eq("id", context.userId)
      .single();
    if (error) {
      if (linksNotMigrated(error)) {
        return {
          available: false as const,
          social: {} as Record<string, string>,
          links: [] as BioLink[],
          featured: [] as string[],
          clicks: {} as ClickCounts,
        };
      }
      throw new Error(error.message);
    }

    const links = bioLinksForDisplay(data.bio_links);
    const social: Record<string, string> = Object.fromEntries(
      socialLinksForDisplay(data.social_links).map((s) => [s.platform, s.url]),
    );

    // Two counts per link (all time, last 30 days). At most six links, so
    // twelve tiny head-only queries beats pulling every click row back.
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const clicks: ClickCounts = {};
    await Promise.all(
      links.map(async (link) => {
        const base = () =>
          context.supabase
            .from("link_clicks")
            .select("id", { count: "exact", head: true })
            .eq("profile_id", context.userId)
            .eq("link_id", link.id);
        const [all, recent] = await Promise.all([base(), base().gte("created_at", since)]);
        clicks[link.id] = { total: all.count ?? 0, last30: recent.count ?? 0 };
      }),
    );

    return {
      available: true as const,
      social,
      links,
      featured: (data.featured_product_ids ?? []).slice(0, MAX_FEATURED),
      clicks,
    };
  });

export const updateMyLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        social: z.record(z.string(), z.string().max(500)),
        links: z
          .array(
            z.object({
              id: z.string().max(40).nullish(),
              title: z.string().max(200),
              url: z.string().max(600),
            }),
          )
          .max(MAX_BIO_LINKS),
        featured: z.array(z.string().uuid()).max(MAX_FEATURED),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const social = normalizeSocialLinks(data.social);
    if (!social.ok) throw new Error(social.error);
    const links = normalizeBioLinks(data.links);
    if (!links.ok) throw new Error(links.error);

    // Only the seller's own products can be pinned to their page, and only
    // ones that are actually published.
    const featured = [...new Set(data.featured)];
    if (featured.length > 0) {
      const { data: owned, error } = await context.supabase
        .from("products")
        .select("id")
        .eq("owner_id", context.userId)
        .not("url_slug", "is", null)
        .in("id", featured);
      if (error) throw new Error(error.message);
      const ok = new Set((owned ?? []).map((p) => p.id));
      if (featured.some((id) => !ok.has(id))) throw new Error("You can only pin your own published products.");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ social_links: social.value, bio_links: links.value, featured_product_ids: featured })
      .eq("id", context.userId);
    if (error) {
      if (linksNotMigrated(error)) throw new Error("Links aren't switched on yet. Please try again a little later.");
      throw new Error(error.message);
    }
    return { ok: true, links: links.value };
  });
