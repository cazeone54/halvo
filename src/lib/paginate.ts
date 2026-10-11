export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

// One page of a list, with the page number clamped so a list that shrinks
// (a product deleted on the last page) never shows an empty page.
export function paginate<T>(items: readonly T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, items.length),
    total: items.length,
  };
}

export function isPageSize(n: unknown): n is PageSize {
  return typeof n === "number" && (PAGE_SIZES as readonly number[]).includes(n);
}
