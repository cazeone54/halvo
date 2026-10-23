import { describe, it, expect } from "vitest";
import { isPatchedNode } from "./node-runtime";

describe("isPatchedNode", () => {
  it("accepts the patched release in each line, and anything after it", () => {
    expect(isPatchedNode("v24.22.1")).toBe(true);
    expect(isPatchedNode("v24.22.2")).toBe(true);
    expect(isPatchedNode("v24.23.0")).toBe(true);
    expect(isPatchedNode("v22.23.4")).toBe(true);
    expect(isPatchedNode("v26.12.1")).toBe(true);
  });

  it("rejects the releases just before the fix", () => {
    expect(isPatchedNode("v24.22.0")).toBe(false);
    expect(isPatchedNode("v24.16.0")).toBe(false);
    expect(isPatchedNode("v22.23.3")).toBe(false);
    expect(isPatchedNode("v26.12.0")).toBe(false);
  });

  it("rejects lines that never got the fix, and treats later lines as fixed", () => {
    expect(isPatchedNode("v20.19.0")).toBe(false);
    expect(isPatchedNode("v23.11.0")).toBe(false);
    expect(isPatchedNode("v27.0.0")).toBe(true);
  });

  it("does not guess on something it can't read", () => {
    expect(isPatchedNode("")).toBe(false);
    expect(isPatchedNode("node")).toBe(false);
  });
});
