import { describe, it, expect } from "vitest";
import { checkFileSize, checkFileCount, checkTotalStorage, checkUploadAgainstLimits, effectiveLimits, FREE_PRODUCT_MAX_MB, UNVERIFIED_MAX_FILE_MB, UNVERIFIED_TOTAL_STORAGE_MB } from "@/lib/upload-limits";
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

  // Was "free's max is smaller than creator/pro". Under single-tier pricing
  // there is nothing to upgrade to, so the limit is the same everywhere and a
  // file at the limit must be accepted rather than hitting a wall with no exit.
  it("accepts a file right at the limit on every tier", () => {
    const atLimit = PLAN_LIMITS.free.maxFileMb * 1024 * 1024;
    for (const tier of [PLAN_LIMITS.free, PLAN_LIMITS.creator, PLAN_LIMITS.pro]) {
      expect(checkFileSize(atLimit, tier)).toBeNull();
    }
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

describe("anti file-hosting limits", () => {
  const MB = 1024 * 1024;
  const base = PLAN_LIMITS.free;
  const empty = { currentCountForProduct: 0, usedBytesAcrossAllProducts: 0 };

  it("unverified sellers get the smaller caps; verified sellers keep the plan's", () => {
    expect(effectiveLimits(base, false).maxFileMb).toBe(Math.min(base.maxFileMb, UNVERIFIED_MAX_FILE_MB));
    expect(effectiveLimits(base, false).totalStorageMb).toBe(Math.min(base.totalStorageMb, UNVERIFIED_TOTAL_STORAGE_MB));
    expect(effectiveLimits(base, true)).toEqual(base);
  });

  it("a 300 MB file is refused before Stripe is connected, with how to lift it", () => {
    const msg = checkUploadAgainstLimits({ ...empty, sizeBytes: 300 * MB, verified: false }, base);
    expect(msg).toMatch(/250 MB/);
    expect(msg).toMatch(/Connect Stripe/);
    expect(checkUploadAgainstLimits({ ...empty, sizeBytes: 300 * MB, verified: true }, base)).toBeNull();
  });

  it("unverified total storage stops at 1 GB", () => {
    const msg = checkUploadAgainstLimits(
      { sizeBytes: 100 * MB, currentCountForProduct: 0, usedBytesAcrossAllProducts: 1000 * MB, verified: false },
      base,
    );
    expect(msg).toMatch(/storage limit/);
  });

  it("free products hold at most 250 MB in total, for every seller", () => {
    const params = { ...empty, sizeBytes: 100 * MB, usedBytesForProduct: 200 * MB, productIsFree: true };
    expect(checkUploadAgainstLimits({ ...params, verified: true }, base)).toMatch(new RegExp(`${FREE_PRODUCT_MAX_MB} MB`));
    expect(checkUploadAgainstLimits({ ...params, verified: false }, base)).not.toMatch(/Connect Stripe/);
    expect(checkUploadAgainstLimits({ ...params, usedBytesForProduct: 100 * MB, verified: true }, base)).toBeNull();
  });

  it("calls without the new fields behave as before (verified, paid)", () => {
    expect(checkUploadAgainstLimits({ ...empty, sizeBytes: 300 * MB }, base)).toBeNull();
  });
});