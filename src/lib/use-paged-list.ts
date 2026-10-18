import { useEffect, useState } from "react";
import { isPageSize, paginate, type PageSize } from "@/lib/paginate";

// Client-side paging for a list already in memory: 10 / 20 / 50 per page, the
// size remembered per browser under `storageKey`, and back to page 1 whenever
// `resetKey` changes (a new search, filter or sort).
//
// `defaultSize` is for lists that want more on screen before anyone touches the
// control — a four-across product grid looks thin at ten, and ten leaves a
// half-empty last row.
export function usePagedList<T>(
  items: readonly T[],
  storageKey: string,
  resetKey = "",
  defaultSize: PageSize = 10,
) {
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultSize);
  const [page, setPage] = useState(1);

  // Read after mount so the server render and first client render agree.
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      if (isPageSize(saved)) setPageSizeState(saved);
    } catch {
      // Storage blocked — keep the default.
    }
  }, [storageKey]);

  useEffect(() => setPage(1), [resetKey]);

  const setPageSize = (size: PageSize) => {
    setPageSizeState(size);
    setPage(1);
    try {
      window.localStorage.setItem(storageKey, String(size));
    } catch {
      // Storage blocked — the choice just won't be remembered.
    }
  };

  return { ...paginate(items, page, pageSize), pageSize, setPage, setPageSize };
}
