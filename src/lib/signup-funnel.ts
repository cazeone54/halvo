// Where new sellers get to, and where they stop: the steps from sign-up to a
// first buyer, for the accounts made in a period. Pure, so every count on the
// owner's funnel page is tested.
//
// Built after the Nov 2026 audit, which had to be done by hand: 44 accounts,
// 15 never confirmed their email, 13 did nothing, 7 stopped mid-Stripe, 2 left
// an empty draft, nobody uploaded a file.

export type FunnelAccount = {
  id: string;
  createdAt: string;
  confirmed: boolean; // email confirmed (Google sign-ins always are)
  source: string | null; // signup_sources.source
};

export type FunnelFacts = {
  productOwners: Set<string>; // made at least one product
  liveOwners: Set<string>; // at least one product live (a file or link added)
  stripeStarted: Set<string>;
  stripeDone: Set<string>; // can take payments
  firstBuyer: Set<string>; // at least one free download or sale
};

export const FUNNEL_STEPS = [
  { key: "signedUp", label: "Signed up" },
  { key: "gotIn", label: "Got in (confirmed email or Google)" },
  { key: "product", label: "Started a product" },
  { key: "live", label: "Product live (file or link added)" },
  { key: "stripeStarted", label: "Started Stripe" },
  { key: "stripeDone", label: "Stripe finished" },
  { key: "firstBuyer", label: "First download or sale" },
] as const;

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]["key"];

export function buildSignupFunnel(
  accounts: FunnelAccount[],
  facts: FunnelFacts,
  since: Date | null,
  now: Date,
): {
  steps: Array<{ key: FunnelStepKey; label: string; count: number; ofSignups: number | null }>;
  sources: Array<{ source: string; count: number }>;
  perDay: Array<{ day: string; count: number }>;
} {
  const cohort = accounts.filter((a) => !since || Date.parse(a.createdAt) >= since.getTime());
  const has = (set: Set<string>) => cohort.filter((a) => set.has(a.id)).length;
  const counts: Record<FunnelStepKey, number> = {
    signedUp: cohort.length,
    gotIn: cohort.filter((a) => a.confirmed).length,
    product: has(facts.productOwners),
    live: has(facts.liveOwners),
    stripeStarted: has(facts.stripeStarted),
    stripeDone: has(facts.stripeDone),
    firstBuyer: has(facts.firstBuyer),
  };
  const steps = FUNNEL_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    count: counts[s.key],
    ofSignups: cohort.length > 0 ? counts[s.key] / cohort.length : null,
  }));

  const bySource = new Map<string, number>();
  for (const a of cohort) {
    const s = a.source?.trim() || "Not recorded";
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
  }
  const sources = [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  // The last 14 days, one bar each, so a burst like 6 Nov 2026 stands out.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(today - (13 - i) * 864e5).toISOString().slice(0, 10);
    return { day, count: accounts.filter((a) => a.createdAt.slice(0, 10) === day).length };
  });

  return { steps, sources, perDay };
}
