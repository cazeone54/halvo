import { describe, expect, it } from "vitest";
import { isPageSize, paginate } from "./paginate";

const list = Array.from({ length: 43 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the requested page with a human range", () => {
    expect(paginate(list, 1, 10)).toMatchObject({ items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], page: 1, pageCount: 5, from: 1, to: 10, total: 43 });
    expect(paginate(list, 5, 10)).toMatchObject({ items: [41, 42, 43], from: 41, to: 43 });
    expect(paginate(list, 1, 50).items).toHaveLength(43);
  });
  it("clamps out-of-range pages", () => {
    expect(paginate(list, 9, 20).page).toBe(3);
    expect(paginate(list, 0, 20).page).toBe(1);
    expect(paginate(list, Number.NaN, 20).page).toBe(1);
  });
  it("handles an empty list", () => {
    expect(paginate([], 1, 10)).toMatchObject({ items: [], page: 1, pageCount: 1, from: 0, to: 0, total: 0 });
  });
  it("only accepts the offered page sizes", () => {
    expect(isPageSize(20)).toBe(true);
    expect(isPageSize(25)).toBe(false);
    expect(isPageSize("10")).toBe(false);
  });
});
