import { describe, it, expect, beforeEach, vi } from "vitest";
import { listLocalPurchases, rememberPurchase, forgetLocalPurchases } from "@/lib/local-purchases";

// Minimal localStorage stand-in — the module must work in a browser and must
// not throw anywhere it isn't available.
function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe("local purchase memory", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
  });

  it("remembers a purchase and reads it back", () => {
    rememberPurchase({ transactionId: "t1", productName: "The Home Reset" });
    const list = listLocalPurchases();
    expect(list).toHaveLength(1);
    expect(list[0].transactionId).toBe("t1");
    expect(list[0].productName).toBe("The Home Reset");
    expect(Date.parse(list[0].at)).not.toBeNaN();
  });

  it("puts the newest first", () => {
    rememberPurchase({ transactionId: "old", productName: "A" });
    rememberPurchase({ transactionId: "new", productName: "B" });
    expect(listLocalPurchases().map((p) => p.transactionId)).toEqual(["new", "old"]);
  });

  it("does not duplicate the same transaction on a page refresh", () => {
    rememberPurchase({ transactionId: "t1", productName: "A" });
    rememberPurchase({ transactionId: "t1", productName: "A" });
    expect(listLocalPurchases()).toHaveLength(1);
  });

  it("caps the list so storage can't grow without bound", () => {
    for (let i = 0; i < 60; i++) rememberPurchase({ transactionId: `t${i}`, productName: "P" });
    expect(listLocalPurchases().length).toBeLessThanOrEqual(50);
  });

  it("forgets everything on request — the shared-computer case", () => {
    rememberPurchase({ transactionId: "t1", productName: "A" });
    forgetLocalPurchases();
    expect(listLocalPurchases()).toEqual([]);
  });

  it("returns empty rather than throwing when the stored value is corrupt", () => {
    localStorage.setItem("halvo-purchases", "{not json");
    expect(listLocalPurchases()).toEqual([]);
  });

  it("drops malformed entries instead of surfacing them", () => {
    localStorage.setItem("halvo-purchases", JSON.stringify([{ nope: true }, { transactionId: "t1", productName: "A", at: "x" }]));
    expect(listLocalPurchases()).toHaveLength(1);
  });

  it("never throws when storage is unavailable (private mode, blocked site data)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    });
    expect(() => rememberPurchase({ transactionId: "t1", productName: "A" })).not.toThrow();
    expect(listLocalPurchases()).toEqual([]);
    expect(() => forgetLocalPurchases()).not.toThrow();
  });
});
