import { describe, expect, it } from "vitest";
import { buildNudgeEmail, firstNameOf, nextNudge, type NudgeProduct, type SellerState } from "./seller-nudge";

const now = new Date("2026-11-13T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const product = (over: Partial<NudgeProduct> = {}): NudgeProduct => ({
  name: "Meal Plan",
  slug: "meal-plan-abc",
  free: false,
  hasFile: true,
  createdAt: daysAgo(3),
  ...over,
});
const seller = (over: Partial<SellerState> = {}): SellerState => ({
  signedUpAt: daysAgo(5),
  stripe: "none",
  deactivated: false,
  products: [],
  hasViews: false,
  sent: {},
  ...over,
});

describe("which reminder a seller gets", () => {
  it("asks someone who started Stripe to finish it", () => {
    expect(nextNudge(seller({ stripe: "started" }), now)).toMatchObject({ kind: "stripe", variant: "finish" });
  });

  it("asks someone with a live paid product and no Stripe to connect it", () => {
    expect(nextNudge(seller({ products: [product()] }), now)).toMatchObject({ kind: "stripe", variant: "connect", product: { name: "Meal Plan" } });
  });

  it("doesn't ask to share a paid product buyers can't see yet", () => {
    expect(nextNudge(seller({ products: [product()], sent: { stripe: daysAgo(10) } }), now)).toBeNull();
  });

  it("asks to share a product buyers can open that nobody has visited", () => {
    expect(nextNudge(seller({ stripe: "ready", products: [product()] }), now)).toMatchObject({ kind: "share", variant: "share" });
    expect(nextNudge(seller({ products: [product({ free: true })] }), now)).toMatchObject({ kind: "share" });
  });

  it("says nothing once the product has had visits", () => {
    expect(nextNudge(seller({ stripe: "ready", products: [product()], hasViews: true }), now)).toBeNull();
  });

  it("ignores drafts and products with no file", () => {
    expect(nextNudge(seller({ products: [product({ slug: null, free: true })] }), now)).toBeNull();
    expect(nextNudge(seller({ products: [product({ hasFile: false, free: true })] }), now)).toBeNull();
  });

  it("waits a day after sign-up and after the product was made", () => {
    expect(nextNudge(seller({ stripe: "started", signedUpAt: daysAgo(0.5) }), now)).toBeNull();
    expect(nextNudge(seller({ products: [product({ free: true, createdAt: daysAgo(0.5) })] }), now)).toBeNull();
  });

  it("sends each reminder once, and never two within two days", () => {
    expect(nextNudge(seller({ stripe: "started", sent: { stripe: daysAgo(30) } }), now)).toBeNull();
    const both = seller({ stripe: "started", products: [product({ free: true })] });
    expect(nextNudge(both, now)).toMatchObject({ kind: "stripe" });
    expect(nextNudge({ ...both, sent: { stripe: daysAgo(1) } }, now)).toBeNull();
    expect(nextNudge({ ...both, sent: { stripe: daysAgo(3) } }, now)).toMatchObject({ kind: "share" });
  });

  it("never emails a deactivated seller", () => {
    expect(nextNudge(seller({ stripe: "started", deactivated: true }), now)).toBeNull();
  });
});

describe("the reminder emails", () => {
  const base = { firstName: "Ana", productName: "Meal Plan", productUrl: "https://halvo.io/p/meal-plan-abc", dashboardUrl: "https://halvo.io/dashboard" };

  it("each say what to do and link to it", () => {
    const finish = buildNudgeEmail({ ...base, variant: "finish" });
    expect(finish.subject).toBe("One step left before you can get paid");
    expect(finish.text).toContain("Finish connecting Stripe: https://halvo.io/dashboard");
    expect(buildNudgeEmail({ ...base, variant: "connect" }).subject).toBe("Meal Plan can't be bought yet");
    const share = buildNudgeEmail({ ...base, variant: "share" });
    expect(share.text).toContain("Your link: https://halvo.io/p/meal-plan-abc");
    expect(share.html).toContain("Hi Ana,");
  });

  it("name the hidden product when there is one, and don't invent one when there isn't", () => {
    expect(buildNudgeEmail({ ...base, variant: "finish" }).text).toContain("nobody can buy Meal Plan");
    const noProduct = buildNudgeEmail({ ...base, productName: null, variant: "finish" }).text;
    expect(noProduct).toContain("you can't take payments");
    expect(noProduct).not.toContain("your product");
  });

  it("say they're one-time", () => {
    expect(buildNudgeEmail({ ...base, variant: "share" }).text).toContain("We won't send it again.");
  });

  it("escape a product name in the HTML", () => {
    expect(buildNudgeEmail({ ...base, productName: "<b>Hi</b>", variant: "connect" }).html).not.toContain("<b>Hi</b>");
  });

  it("greet by first name only when there is one", () => {
    expect(firstNameOf("Ana Maria Lopez")).toBe("Ana");
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf("someone@example.com")).toBeNull();
  });
});
