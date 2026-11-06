import { describe, expect, it } from "vitest";
import { isInOwnerFolder, isSellersFile, isServableImageType, sameOwner } from "./owned-storage";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

describe("isInOwnerFolder", () => {
  it("accepts a path inside the owner's own folder", () => {
    expect(isInOwnerFolder(`${A}/p1/cover.png`, A)).toBe(true);
  });
  it("rejects another seller's folder, look-alike prefixes and traversal", () => {
    expect(isInOwnerFolder(`${B}/p1/file.zip`, A)).toBe(false);
    expect(isInOwnerFolder(`${A}x/p1/file.zip`, A)).toBe(false);
    expect(isInOwnerFolder(`${A}/../${B}/file.zip`, A)).toBe(false);
    expect(isInOwnerFolder(null, A)).toBe(false);
    expect(isInOwnerFolder(`${A}/p1/cover.png`, null)).toBe(false);
  });
});

describe("isServableImageType", () => {
  it("serves ordinary image types", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "IMAGE/PNG; charset=binary"]) {
      expect(isServableImageType(t)).toBe(true);
    }
  });
  it("never serves anything that can carry script", () => {
    for (const t of ["image/svg+xml", "text/html", "application/xhtml+xml", "application/pdf", "", null]) {
      expect(isServableImageType(t)).toBe(false);
    }
  });
});

describe("sameOwner", () => {
  it("matches equal owners, and a deleted seller's null with null", () => {
    expect(sameOwner(A, A)).toBe(true);
    expect(sameOwner(null, null)).toBe(true);
  });
  it("never matches different owners, null with a real id, or something not found", () => {
    expect(sameOwner(A, B)).toBe(false);
    expect(sameOwner(A, null)).toBe(false);
    expect(sameOwner(undefined, undefined)).toBe(false);
  });
});

describe("isSellersFile", () => {
  it("delivers the seller's own files from their own folder", () => {
    expect(isSellersFile({ owner_id: A, storage_file_path: `${A}/p1/book.pdf` }, A)).toBe(true);
  });
  it("refuses a file another seller attached to this product", () => {
    expect(isSellersFile({ owner_id: B, storage_file_path: `${B}/x/malware.exe` }, A)).toBe(false);
  });
  it("refuses a row on the seller's own product that points into another seller's folder", () => {
    expect(isSellersFile({ owner_id: A, storage_file_path: `${B}/p9/paid.zip` }, A)).toBe(false);
  });
  it("still delivers a deleted seller's kept files to their buyers", () => {
    expect(isSellersFile({ owner_id: null, storage_file_path: `${A}/p1/book.pdf` }, null)).toBe(true);
  });
  it("refuses files of a product that no longer exists", () => {
    expect(isSellersFile({ owner_id: A, storage_file_path: `${A}/p1/book.pdf` }, undefined)).toBe(false);
  });
});
