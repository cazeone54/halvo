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

// Runs all three checks; returns the first failure message, or null if the
// upload is allowed.
export function checkUploadAgainstLimits(
  params: { sizeBytes: number; currentCountForProduct: number; usedBytesAcrossAllProducts: number },
  limits: PlanLimits,
): string | null {
  return (
    checkFileSize(params.sizeBytes, limits) ??
    checkFileCount(params.currentCountForProduct, limits) ??
    checkTotalStorage(params.usedBytesAcrossAllProducts, params.sizeBytes, limits)
  );
}
