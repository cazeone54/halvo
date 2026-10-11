import { describe, expect, it } from "vitest";
import { bytesByOwner, findOrphans, ORPHAN_GRACE_MS } from "./storage-sweep";

const now = new Date("2026-10-12T12:00:00Z");
const old = new Date(now.getTime() - ORPHAN_GRACE_MS - 1000).toISOString();
const fresh = new Date(now.getTime() - 60_000).toISOString();

describe("findOrphans", () => {
  const objects = [
    { path: "u1/p1/file.pdf", sizeBytes: 10, createdAt: old },
    { path: "u1/p1/stray.zip", sizeBytes: 500, createdAt: old },
    { path: "u1/p2/just-uploaded.zip", sizeBytes: 5, createdAt: fresh },
    { path: "u2/avatar/me.png", sizeBytes: 3, createdAt: old },
    { path: "u2/x/unknown-age.bin", sizeBytes: 9, createdAt: "" },
  ];
  const referenced = new Set(["u1/p1/file.pdf", "u2/avatar/me.png"]);

  it("flags only unreferenced objects older than the grace period", () => {
    expect(findOrphans(objects, referenced, now).map((o) => o.path)).toEqual(["u1/p1/stray.zip"]);
  });
  it("never flags a referenced object, however old", () => {
    expect(findOrphans(objects, new Set(objects.map((o) => o.path)), now)).toEqual([]);
  });
});

describe("bytesByOwner", () => {
  it("sums every stored byte per user, orphans included", () => {
    const totals = bytesByOwner([
      { path: "u1/a", sizeBytes: 10, createdAt: old },
      { path: "u1/b/c", sizeBytes: 5, createdAt: old },
      { path: "u2/d", sizeBytes: 7, createdAt: old },
    ]);
    expect(totals.get("u1")).toBe(15);
    expect(totals.get("u2")).toBe(7);
  });
});
