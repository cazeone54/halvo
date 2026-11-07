import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSignupFunnel, type FunnelAccount } from "@/lib/signup-funnel";
import { isPeriod, periodWindow, type Period } from "@/lib/analytics-math";

type Admin = SupabaseClient<Database>;

// Halvo's own shop. Its owner is the platform owner, so the funnel page needs
// no setup; ADMIN_EMAILS (comma-separated), when set, decides instead.
const PLATFORM_SHOP_HANDLE = "halvo-press";

async function isPlatformOwner(admin: Admin, userId: string, email: string | null): Promise<boolean> {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0) return !!email && allowed.includes(email.toLowerCase());
  const { data } = await admin.from("profiles").select("id").eq("handle", PLATFORM_SHOP_HANDLE).maybeSingle();
  return !!data && data.id === userId;
}

// Every row, past the API's 1,000-row page, capped so a huge table can't stall it.
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cap = 50_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) return out;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

// The owner's view of where new sellers stop, from sign-up to a first buyer.
// Anyone else gets { allowed: false } and the page says it's not for them.
export const getSignupFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ period: z.number().optional() }).optional().parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claimedEmail = (context.claims as { email?: unknown }).email;
    const email = typeof claimedEmail === "string" ? claimedEmail : null;
    if (!(await isPlatformOwner(supabaseAdmin, context.userId, email))) return { allowed: false as const };

    const period: Period = isPeriod(data?.period) ? (data!.period as Period) : 30;
    const now = new Date();
    const { since } = periodWindow(period, now);

    const users: Array<{ id: string; created_at: string; email_confirmed_at?: string | null }> = [];
    for (let page = 1; page <= 50; page++) {
      const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      users.push(...res.users);
      if (res.users.length < 1000) break;
    }

    const [profiles, products, sales, sources] = await Promise.all([
      readAll((f, t) =>
        supabaseAdmin.from("profiles").select("id, stripe_connect_id, stripe_charges_enabled").order("id").range(f, t),
      ),
      readAll((f, t) => supabaseAdmin.from("products").select("owner_id, url_slug").order("id").range(f, t)),
      readAll((f, t) =>
        supabaseAdmin.from("transactions").select("seller_id").eq("status", "success").order("id").range(f, t),
      ),
      readAll((f, t) => supabaseAdmin.from("signup_sources").select("user_id, source").order("user_id").range(f, t)),
    ]);

    const sourceOf = new Map(sources.map((s) => [s.user_id, s.source]));
    // The owner's own account would only blur the picture.
    const accounts: FunnelAccount[] = users
      .filter((u) => u.id !== context.userId)
      .map((u) => ({ id: u.id, createdAt: u.created_at, confirmed: !!u.email_confirmed_at, source: sourceOf.get(u.id) ?? null }));

    const ids = (rows: Array<string | null>) => new Set(rows.filter((x): x is string => !!x));
    const funnel = buildSignupFunnel(
      accounts,
      {
        productOwners: ids(products.map((p) => p.owner_id)),
        liveOwners: ids(products.filter((p) => p.url_slug).map((p) => p.owner_id)),
        stripeStarted: ids(profiles.filter((p) => p.stripe_connect_id).map((p) => p.id)),
        stripeDone: ids(profiles.filter((p) => p.stripe_charges_enabled).map((p) => p.id)),
        firstBuyer: ids(sales.map((s) => s.seller_id)),
      },
      since,
      now,
    );
    return { allowed: true as const, period, ...funnel };
  });
