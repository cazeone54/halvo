// How much free delivery one seller gets each month.
//
// Free products (lead magnets) bring in no fee, so every byte they serve is a
// cost. Uploads are already limited — 250 MB per free product, and 1 GB in
// total until Stripe has verified who the seller is — but nothing limited how
// many times a free file could be handed out, which is the expensive half.
//
// This is a hard cap, unlike the plan's overall bandwidth figure: that one
// must never block a buyer who paid. Free downloads have no such claim, so
// they stop and start again next month.
//
// 10 GB is generous for a real lead magnet (a 5 MB PDF given away 2,000 times)
// and costs roughly a dollar a month to serve at Supabase's egress rate.

const BYTES_PER_GB = 1024 * 1024 * 1024;

export const FREE_DOWNLOAD_GB_PER_MONTH = 10;

export function freeDownloadLimitBytes(limitGb = FREE_DOWNLOAD_GB_PER_MONTH): number {
  return limitGb * BYTES_PER_GB;
}

export function isOverFreeDownloadCap(usedBytes: number, limitGb = FREE_DOWNLOAD_GB_PER_MONTH): boolean {
  if (!Number.isFinite(usedBytes) || usedBytes <= 0) return false;
  return usedBytes >= freeDownloadLimitBytes(limitGb);
}

// Shown to someone trying to get a free file the seller has given away too
// much of this month. Says what happened and what to do, without blaming them
// or exposing the seller's numbers.
export const FREE_DOWNLOAD_BLOCKED_MESSAGE =
  "This free download has reached its limit for this month. It'll be available again on the 1st — or contact the seller, who can lift it by setting a price on it.";
