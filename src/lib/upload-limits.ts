// Pure decision logic for the file/storage limits declared in plans.ts.
// Kept separate so it's testable without mocking Supabase Storage/DB calls,
// and reused by both the pre-upload check (before the client uploads bytes
// to Storage) and the post-upload attach step (defense in depth against a
// race between two concurrent uploads).
import type { PlanLimits } from "@/lib/plans";

const MB = 1024 * 1024;

export function checkFileSize(sizeBytes: number, limits: PlanLimits): string | null {
  const maxBytes = limits.maxFileMb * MB;
  if (sizeBytes > maxBytes) {
    return `File exceeds the ${limits.maxFileMb} MB limit on your plan.`;
  }
  return null;
}

export function checkFileCount(currentCountForProduct: number, limits: PlanLimits): string | null {
  if (currentCountForProduct >= limits.filesPerProduct) {
    return `This product already has the maximum of ${limits.filesPerProduct} file(s) allowed on your plan.`;
  }
  return null;
}

export function formatMb(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

export function checkTotalStorage(
  usedBytesAcrossAllProducts: number,
  newFileBytes: number,
  limits: PlanLimits,
): string | null {
  const limitBytes = limits.totalStorageMb * MB;
  if (usedBytesAcrossAllProducts + newFileBytes > limitBytes) {
    return `This upload would exceed your ${formatMb(limits.totalStorageMb)} storage limit.`;
  }
  return null;
}

// ── Anti file-hosting limits ───────────────────────────────────────────────
// Single-tier pricing made every new account free, which also makes Halvo a
// tempting free file host: sign up with any email, upload, hand out "free
// product" links. Two rules close that without getting in real sellers' way:
//
//  1. A free product can hold at most FREE_PRODUCT_MAX_MB in total (Gumroad
//     draws the same line at 250 MB). Free lead magnets are PDFs and
//     checklists; anything bigger is a product worth charging for.
//  2. Until a seller connects Stripe — which verifies their identity — they
//     get UNVERIFIED caps. Unverified sellers can only distribute free
//     products anyway (paid checkout needs Stripe), so this costs a genuine
//     seller nothing, and an abuser gets 1 GB at most, under a real name never.
export const FREE_PRODUCT_MAX_MB = 250;
export const UNVERIFIED_MAX_FILE_MB = 250;
export const UNVERIFIED_TOTAL_STORAGE_MB = 1024;

export function effectiveLimits(base: PlanLimits, verified: boolean): PlanLimits {
  if (verified) return base;
  return {
    ...base,
    maxFileMb: Math.min(base.maxFileMb, UNVERIFIED_MAX_FILE_MB),
    totalStorageMb: Math.min(base.totalStorageMb, UNVERIFIED_TOTAL_STORAGE_MB),
  };
}

export function isFreePricing(p: { price_cents: number; pay_what_you_want: boolean }): boolean {
  return !p.pay_what_you_want && p.price_cents === 0;
}

// The total size a free product may hold (its existing files + the new one).
export function checkFreeProductSize(productBytesAfterUpload: number): string | null {
  if (productBytesAfterUpload > FREE_PRODUCT_MAX_MB * MB) {
    return `Free products can hold up to ${FREE_PRODUCT_MAX_MB} MB in total. Set a price to deliver bigger files.`;
  }
  return null;
}

// Runs every check; returns the first failure message, or null if the upload
// is allowed. Messages for unverified sellers say how to lift the limit.
export function checkUploadAgainstLimits(
  params: {
    sizeBytes: number;
    currentCountForProduct: number;
    usedBytesAcrossAllProducts: number;
    usedBytesForProduct?: number;
    productIsFree?: boolean;
    verified?: boolean;
  },
  limits: PlanLimits,
): string | null {
  const verified = params.verified ?? true;
  const applied = effectiveLimits(limits, verified);
  const failure =
    (params.productIsFree ? checkFreeProductSize((params.usedBytesForProduct ?? 0) + params.sizeBytes) : null) ??
    checkFileSize(params.sizeBytes, applied) ??
    checkFileCount(params.currentCountForProduct, applied) ??
    checkTotalStorage(params.usedBytesAcrossAllProducts, params.sizeBytes, applied);
  if (!failure || verified || failure.startsWith("Free products")) return failure;
  // Hitting a cap that only exists because Stripe isn't connected yet.
  const liftable = applied.maxFileMb !== limits.maxFileMb || applied.totalStorageMb !== limits.totalStorageMb;
  return liftable
    ? `${failure} Connect Stripe to raise your limits to ${formatMb(limits.maxFileMb)} per file and ${formatMb(limits.totalStorageMb)} in total.`
    : failure;
}
