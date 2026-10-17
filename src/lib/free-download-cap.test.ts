import { describe, it, expect } from "vitest";
import {
  FREE_DOWNLOAD_GB_PER_MONTH,
  freeDownloadLimitBytes,
  isOverFreeDownloadCap,
} from "./free-download-cap";

const GB = 1024 * 1024 * 1024;

describe("the monthly cap on free downloads", () => {
  it("allows everything up to the limit", () => {
    expect(isOverFreeDownloadCap(0)).toBe(false);
    expect(isOverFreeDownloadCap(5 * GB)).toBe(false);
    expect(isOverFreeDownloadCap(freeDownloadLimitBytes() - 1)).toBe(false);
  });

  it("stops at the limit and beyond", () => {
    expect(isOverFreeDownloadCap(freeDownloadLimitBytes())).toBe(true);
    expect(isOverFreeDownloadCap(50 * GB)).toBe(true);
  });

  it("is generous enough for a real lead magnet", () => {
    // A 5 MB PDF given away 2,000 times in a month is still fine.
    expect(isOverFreeDownloadCap(2000 * 5 * 1024 * 1024)).toBe(false);
    expect(FREE_DOWNLOAD_GB_PER_MONTH).toBeGreaterThanOrEqual(5);
  });

  it("treats missing or nonsense usage as nothing served", () => {
    expect(isOverFreeDownloadCap(-1)).toBe(false);
    expect(isOverFreeDownloadCap(Number.NaN)).toBe(false);
  });

  it("can be tightened or loosened per call", () => {
    expect(isOverFreeDownloadCap(2 * GB, 1)).toBe(true);
    expect(isOverFreeDownloadCap(2 * GB, 100)).toBe(false);
  });
});
