import { describe, it, expect } from "vitest";
import { checkFileSize, checkFileCount, checkTotalStorage, checkUploadAgainstLimits } from "@/lib/upload-limits";
import { PLAN_LIMITS } from "@/lib/plans";

describe("checkFileSize", () => {
  it("allows files at or under the per-tier max", () => {
    const maxBytes = PLAN_LIMITS.free.maxFileMb * 1024 * 1024;
    expect(checkFileSize(maxBytes, PLAN_LIMITS.free)).toBeNull();
    expect(checkFileSize(maxBytes - 1, PLAN_LIMITS.free)).toBeNull();
  });

  it("rejects files over the per-tier max", () => {
    const overBytes = PLAN_LIMITS.free.maxFileMb * 1024 * 1024 + 1;
    expect(checkFileSize(overBytes, PLAN_LIMITS.free)).not.toBeNull();
  });

  it("free tier's max is smaller than creator/pro — a bigger file allowed on Creator is rejected on Free", () => {
    const midSize = (PLAN_LIMITS.free.maxFileMb + 1) * 1024 * 1024;
    expect(checkFileSize(midSize, PLAN_LIMITS.free)).not.toBeNull();
    expect(checkFileSize(midSize, PLAN_LIMITS.creator)).toBeNull();
  });
});

describe("checkFileCount", () => {
  it("allows uploads under the per-product file cap", () => {
    expect(checkFileCount(PLAN_LIMITS.free.filesPerProduct - 1, PLAN_LIMITS.free)).toBeNull();
  });

  it("rejects once the product already has the max file count", () => {
    // The actual gap this fixes: Free is capped at 1 file/product in
    // plans.ts, but nothing enforced it before this change.
    expect(checkFileCount(PLAN_LIMITS.free.filesPerProduct, PLAN_LIMITS.free)).not.toBeNull();
  });
});

describe("checkTotalStorage", () => {
  it("allows uploads that stay within the total storage cap", () => {
    const limitBytes = PLAN_LIMITS.free.totalStorageMb * 1024 * 1024;
    expect(checkTotalStorage(0, limitBytes, PLAN_LIMITS.free)).toBeNull();
  });

  it("rejects uploads that would push total usage over the cap", () => {
    const limitBytes = PLAN_LIMITS.free.totalStorageMb * 1024 * 1024;
    expect(checkTotalStorage(limitBytes - 100, 200, PLAN_LIMITS.free)).not.toBeNull();
  });
});

describe("checkUploadAgainstLimits", () => {
  it("returns null (allowed) when every check passes", () => {
    const result = checkUploadAgainstLimits(
      { sizeBytes: 1024, currentCountForProduct: 0, usedBytesAcrossAllProducts: 0 },
      PLAN_LIMITS.free,
    );
    expect(result).toBeNull();
  });

  it("returns the file-size message first when multiple checks would fail", () => {
    const hugeSizeBytes = (PLAN_LIMITS.free.maxFileMb + 1) * 1024 * 1024;
    const result = checkUploadAgainstLimits(
      {
        sizeBytes: hugeSizeBytes,
        currentCountForProduct: PLAN_LIMITS.free.filesPerProduct, // also over
        usedBytesAcrossAllProducts: PLAN_LIMITS.free.totalStorageMb * 1024 * 1024, // also over
      },
      PLAN_LIMITS.free,
    );
    expect(result).toContain("MB limit");
  });
});
