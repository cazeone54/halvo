import { describe, it, expect } from "vitest";
import {
  buildReturnUrl,
  clearPendingCheckout,
  readPendingCheckout,
  safeBackPath,
  savePendingCheckout,
  type PendingCheckout,
} from "./pending-checkout";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const entry: PendingCheckout = {
  productId: "11111111-1111-1111-1111-111111111111",
  subscriptionId: null,
  email: "buyer@example.com",
  acknowledged: true,
  referralCode: "FRIEND",
  utmSource: "instagram",
  back: "/p/some-guide",
  savedAt: 1_000_000,
};

describe("pending checkout across a payment-app redirect", () => {
  it("reads back what was saved for the same product", () => {
    const s = memoryStorage();
    savePendingCheckout(entry, s);
    expect(readPendingCheckout(entry.productId, s, entry.savedAt + 60_000)).toEqual(entry);
  });

  it("ignores another product's checkout", () => {
    const s = memoryStorage();
    savePendingCheckout(entry, s);
    expect(readPendingCheckout("22222222-2222-2222-2222-222222222222", s, entry.savedAt)).toBeNull();
  });

  it("ignores a stale entry (older than two hours)", () => {
    const s = memoryStorage();
    savePendingCheckout(entry, s);
    expect(readPendingCheckout(entry.productId, s, entry.savedAt + 3 * 60 * 60 * 1000)).toBeNull();
  });

  it("survives corrupt or missing storage", () => {
    const s = memoryStorage();
    s.setItem("halvo:pending-checkout", "{not json");
    expect(readPendingCheckout(entry.productId, s)).toBeNull();
    expect(readPendingCheckout(entry.productId, null)).toBeNull();
  });

  it("is removed once used", () => {
    const s = memoryStorage();
    savePendingCheckout(entry, s);
    clearPendingCheckout(s);
    expect(readPendingCheckout(entry.productId, s, entry.savedAt)).toBeNull();
  });
});

describe("buildReturnUrl", () => {
  it("points at /checkout/return on this site, with no personal data", () => {
    const url = new URL(buildReturnUrl("https://halvo.io", { productId: entry.productId, subscriptionId: null, acknowledged: true, back: "/p/some-guide" }));
    expect(url.origin + url.pathname).toBe("https://halvo.io/checkout/return");
    expect(url.searchParams.get("pid")).toBe(entry.productId);
    expect(url.searchParams.get("ack")).toBe("1");
    expect(url.searchParams.get("back")).toBe("/p/some-guide");
    expect(url.searchParams.has("sub")).toBe(false);
    expect(url.toString()).not.toContain("@");
  });

  it("carries the subscription for memberships and payment plans", () => {
    const url = new URL(buildReturnUrl("https://halvo.io", { productId: entry.productId, subscriptionId: "sub_123", acknowledged: false, back: "/p/x" }));
    expect(url.searchParams.get("sub")).toBe("sub_123");
    expect(url.searchParams.has("ack")).toBe(false);
  });
});

describe("safeBackPath", () => {
  it("keeps paths on this site", () => {
    expect(safeBackPath("/p/some-guide?embed=1")).toBe("/p/some-guide?embed=1");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeBackPath("https://evil.example")).toBe("/discover");
    expect(safeBackPath("//evil.example")).toBe("/discover");
    expect(safeBackPath("/\\evil.example")).toBe("/discover");
    expect(safeBackPath(undefined)).toBe("/discover");
  });
});
