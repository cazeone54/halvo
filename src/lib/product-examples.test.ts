import { describe, expect, it } from "vitest";
import { PRODUCT_EXAMPLES, findProductExample } from "./product-examples";

describe("product examples", () => {
  it("has unique keys", () => {
    const keys = PRODUCT_EXAMPLES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every price parses to a valid non-negative number, as the create form expects", () => {
    for (const e of PRODUCT_EXAMPLES) {
      const n = Number(e.price);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes a free example, since a free lead magnet needs no Stripe setup", () => {
    expect(PRODUCT_EXAMPLES.some((e) => Number(e.price) === 0)).toBe(true);
  });

  it("finds by key and returns undefined for unknown keys", () => {
    expect(findProductExample("template")?.label).toBe("Notion template");
    expect(findProductExample("nope")).toBeUndefined();
  });
});
