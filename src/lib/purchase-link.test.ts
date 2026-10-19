import { describe, it, expect } from "vitest";
import { purchaseLink, readPurchaseId } from "./purchase-link";

const ID = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e60";

function searchOf(url: string): Record<string, unknown> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

describe("the permanent download link", () => {
  // The bug this guards: the link was built with one parameter name and read
  // with another, so every saved link led to "No purchase to show here".
  it("is read back by the page that receives it", () => {
    const url = purchaseLink("https://halvo.io", ID);
    expect(readPurchaseId(searchOf(url))).toBe(ID);
  });

  it("points at the download page", () => {
    expect(purchaseLink("https://halvo.io", ID)).toBe(`https://halvo.io/success?id=${ID}`);
  });

  it("still accepts a link saved with the older parameter", () => {
    expect(readPurchaseId({ transactionId: ID })).toBe(ID);
  });

  it("ignores anything that isn't a purchase", () => {
    expect(readPurchaseId({})).toBeUndefined();
    expect(readPurchaseId({ id: "not-a-uuid" })).toBeUndefined();
    expect(readPurchaseId({ id: "" })).toBeUndefined();
    expect(readPurchaseId({ id: 42 })).toBeUndefined();
  });
});
