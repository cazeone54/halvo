// Sliding-window rate limiting. The decision logic (pruneAndCheck) is pure
// and testable; the in-memory Map wrapper around it is the only stateful
// part, matching Kitsly's own in-memory-per-process rate limiting approach
// (best-effort on a single Node server process, not a distributed limiter).
export function pruneAndCheck(
  timestamps: number[],
  now: number,
  maxRequests: number,
  windowMs: number,
): { limited: boolean; updated: number[] } {
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) return { limited: true, updated: recent };
  return { limited: false, updated: [...recent, now] };
}

const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const { limited, updated } = pruneAndCheck(buckets.get(key) ?? [], Date.now(), maxRequests, windowMs);
  buckets.set(key, updated);
  return limited;
}
