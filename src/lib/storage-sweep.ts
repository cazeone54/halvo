// Which stored objects are orphans: in the bucket, but not referenced by any
// product file, cover, gallery image or avatar. Uploads go straight from the
// browser to Storage, so someone could skip the app's checks, upload without
// ever attaching the file, and use Halvo as free storage. Orphans are removed
// after a grace period (a real upload is attached within seconds).
export type StoredObject = { path: string; sizeBytes: number; createdAt: string };

export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export function findOrphans(
  objects: readonly StoredObject[],
  referenced: ReadonlySet<string>,
  now: Date,
  graceMs = ORPHAN_GRACE_MS,
): StoredObject[] {
  return objects.filter((o) => {
    if (referenced.has(o.path)) return false;
    const created = Date.parse(o.createdAt);
    // Unknown age → keep it; deleting a real file is far worse than keeping junk a day longer.
    if (!Number.isFinite(created)) return false;
    return now.getTime() - created > graceMs;
  });
}

// Bytes stored per user (first path segment), orphans included — the real
// footprint, which the app's own counters can't see.
export function bytesByOwner(objects: readonly StoredObject[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const o of objects) {
    const owner = o.path.split("/")[0];
    totals.set(owner, (totals.get(owner) ?? 0) + o.sizeBytes);
  }
  return totals;
}
