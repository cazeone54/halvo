import { describe, expect, it } from "vitest";
import { stripeProfilePrefill } from "./stripe-prefill";

const base = "https://halvo.io";

describe("stripeProfilePrefill", () => {
  it("gives Stripe the seller's shop page as their website", () => {
    const r = stripeProfilePrefill({ baseUrl: base, handle: "maria", products: [] });
    expect(r.businessUrl).toBe("https://halvo.io/maria");
  });

  it("without a shop address, uses a live free product — never a paid one Stripe's reviewers couldn't open", () => {
    const products = [
      { name: "Paid guide", slug: "paid-guide-a1", free: false },
      { name: "Free checklist", slug: "free-checklist-b2", free: true },
    ];
    expect(stripeProfilePrefill({ baseUrl: base, handle: null, products }).businessUrl).toBe(
      "https://halvo.io/p/free-checklist-b2",
    );
    expect(stripeProfilePrefill({ baseUrl: base, handle: null, products: [products[0]] }).businessUrl).toBeNull();
    expect(
      stripeProfilePrefill({ baseUrl: base, handle: null, products: [{ name: "Draft", slug: null, free: true }] }).businessUrl,
    ).toBeNull();
  });

  it("describes what they sell, naming up to three products", () => {
    const r = stripeProfilePrefill({
      baseUrl: base,
      handle: null,
      products: ["A", "B", "C", "D"].map((name) => ({ name, slug: null, free: false })),
    });
    expect(r.productDescription).toMatch(/^Digital products/);
    expect(r.productDescription).toContain('Products include "A", "B", "C".');
    expect(r.productDescription).not.toContain('"D"');
  });

  it("still describes the shop when there are no products yet", () => {
    const r = stripeProfilePrefill({ baseUrl: base, handle: "maria", products: [] });
    expect(r.productDescription).not.toContain("Products include");
  });
});
