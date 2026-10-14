import { describe, it, expect } from "vitest";
import { isListedPublicly, isReachableByLink, type ListingVisibility } from "./seller-visibility.server";

// The rule the owner asked for: a product from a seller who hasn't connected
// Stripe must not be visible to buyers. Free products are the one exception
// for direct links, because they work without Stripe.
describe("isListedPublicly (Discover, category chips, sitemap)", () => {
  const visibility: ListingVisibility = {
    deactivated: new Set(["gone"]),
    chargeReady: new Set(["paid-up"]),
  };

  it("lists products of sellers who can take payments", () => {
    expect(isListedPublicly({ owner_id: "paid-up" }, visibility)).toBe(true);
  });

  it("leaves out every product of a seller without Stripe, free ones included", () => {
    expect(isListedPublicly({ owner_id: "no-stripe" }, visibility)).toBe(false);
  });

  it("still leaves out deactivated sellers, even if their Stripe works", () => {
    const both: ListingVisibility = { deactivated: new Set(["x"]), chargeReady: new Set(["x"]) };
    expect(isListedPublicly({ owner_id: "x" }, both)).toBe(false);
  });

  it("keeps the old behaviour when the flag can't be read (migration not applied)", () => {
    const unknown: ListingVisibility = { deactivated: new Set(), chargeReady: null };
    expect(isListedPublicly({ owner_id: "no-stripe" }, unknown)).toBe(true);
  });

  it("treats a product with no owner (deleted account) as before", () => {
    expect(isListedPublicly({ owner_id: null }, visibility)).toBe(true);
  });
});

describe("isReachableByLink (product page, storefront, more from this seller)", () => {
  const paid = { price_cents: 1900, pay_what_you_want: false };
  const free = { price_cents: 0, pay_what_you_want: false };
  const nameYourPrice = { price_cents: 0, pay_what_you_want: true };

  it("hides a paid product while the seller can't take payments", () => {
    expect(isReachableByLink(paid, false)).toBe(false);
  });

  it("hides a pay-what-you-want product too: it needs a payment", () => {
    expect(isReachableByLink(nameYourPrice, false)).toBe(false);
  });

  it("keeps a free product reachable: it works without Stripe", () => {
    expect(isReachableByLink(free, false)).toBe(true);
  });

  it("shows everything once the seller can take payments", () => {
    expect(isReachableByLink(paid, true)).toBe(true);
  });

  it("keeps the old behaviour when the seller's status is unknown", () => {
    expect(isReachableByLink(paid, null)).toBe(true);
  });
});
