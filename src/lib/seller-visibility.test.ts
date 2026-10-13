import { describe, expect, it } from "vitest";
import { isSellerVisible } from "./seller-visibility.server";

// The rule that keeps a deactivated seller out of Discover, its category chips
// and the sitemap. Verified end-to-end against the real database for the
// storefront, product page and sitemap; this pins the predicate itself, which
// is the part that's easy to write backwards.
describe("isSellerVisible", () => {
  const deactivated = new Set(["hidden-seller"]);

  it("hides a row owned by a deactivated seller", () => {
    expect(isSellerVisible("hidden-seller", deactivated)).toBe(false);
  });

  it("shows a row owned by an active seller", () => {
    expect(isSellerVisible("active-seller", deactivated)).toBe(true);
  });

  it("shows a row with no owner — a deleted account, already unpublished", () => {
    // owner_id is null only after the account was deleted, and deletion
    // unpublishes everything first. Treating null as "hidden" here would be
    // harmless; treating it as a crash would not be, so it's pinned.
    expect(isSellerVisible(null, deactivated)).toBe(true);
  });

  it("shows everything when nobody is deactivated", () => {
    const none = new Set<string>();
    expect(isSellerVisible("anyone", none)).toBe(true);
    expect(isSellerVisible(null, none)).toBe(true);
  });

  it("hides every row of a deactivated seller, not just the first", () => {
    const rows = [
      { owner_id: "hidden-seller" },
      { owner_id: "active-seller" },
      { owner_id: "hidden-seller" },
      { owner_id: null },
    ];
    expect(rows.filter((r) => isSellerVisible(r.owner_id, deactivated))).toEqual([
      { owner_id: "active-seller" },
      { owner_id: null },
    ]);
  });
});
