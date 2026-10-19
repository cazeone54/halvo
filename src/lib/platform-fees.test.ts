import { describe, expect, it } from "vitest";
import { comparePlatforms, stanCrossoverSales, type PlatformId } from "./platform-fees";

// Halvo under direct charges: 5%, no fixed fee. Passed in explicitly so these
// tests don't depend on the VITE_STRIPE_DIRECT_CHARGES env var.
const HALVO = { pct: 0.05, fixedCents: 0 };

const keep = (rows: ReturnType<typeof comparePlatforms>, id: PlatformId) =>
  rows.find((r) => r.id === id)!.monthlyKeepCents;

describe("comparePlatforms — one $29 sale, US seller and buyer", () => {
  const rows = comparePlatforms(2900, 1, HALVO);

  it("matches the figures quoted in public", () => {
    // 5% = 145, card 2.9% + 30 = 84 + 30 = 114 → 259
    expect(keep(rows, "halvo")).toBe(2641);
    // 5% + 50 = 195, processing included
    expect(keep(rows, "lemon-squeezy")).toBe(2705);
    // Free plan: 5% + card, same as Halvo
    expect(keep(rows, "payhip")).toBe(2641);
    // 10% + 50 = 340, plus card 114 → 454
    expect(keep(rows, "gumroad")).toBe(2446);
    // 30% all in
    expect(keep(rows, "gumroad-discover")).toBe(2030);
    // One sale cannot cover a $29 month: 2900 − 114 − 2900
    expect(keep(rows, "stan")).toBe(-114);
  });

  it("puts Lemon Squeezy first, because on a US sale it genuinely is cheapest", () => {
    expect(rows[0].id).toBe("lemon-squeezy");
  });

  it("lists Halvo ahead of an exact tie with Payhip, without inventing a lead", () => {
    const order = rows.map((r) => r.id);
    expect(order.indexOf("halvo")).toBeLessThan(order.indexOf("payhip"));
    expect(keep(rows, "halvo")).toBe(keep(rows, "payhip"));
  });

  it("marks who handles tax", () => {
    const tax = Object.fromEntries(rows.map((r) => [r.id, r.handlesTax]));
    expect(tax).toEqual({
      halvo: false,
      "lemon-squeezy": true,
      payhip: true,
      gumroad: true,
      stan: false,
      "gumroad-discover": true,
    });
  });
});

describe("comparePlatforms — volume", () => {
  it("moves Payhip to Plus once 3% of revenue exceeds $29", () => {
    // 50 × $29 = $1,450 a month, above the $966.67 crossover
    const payhip = comparePlatforms(2900, 50, HALVO).find((r) => r.id === "payhip")!;
    expect(payhip.plan).toBe("Plus");
  });

  it("keeps Payhip on Free for a small seller", () => {
    expect(comparePlatforms(2900, 5, HALVO).find((r) => r.id === "payhip")!.plan).toBe("Free");
  });

  it("charges Stan's monthly fee even in a month with no sales", () => {
    const rows = comparePlatforms(2900, 0, HALVO);
    expect(keep(rows, "stan")).toBe(-2900);
    expect(keep(rows, "halvo")).toBe(0);
  });
});

describe("comparePlatforms — edges", () => {
  it("charges nothing per sale on a free product", () => {
    for (const r of comparePlatforms(0, 10, HALVO)) expect(r.perSaleFeeCents).toBe(0);
  });

  it("uses the Halvo rate it is given, not a hardcoded one", () => {
    const destination = { pct: 0.07, fixedCents: 35 };
    const halvo = comparePlatforms(2900, 1, destination).find((r) => r.id === "halvo")!;
    // 7% = 203, + 35, + card 114 → 352
    expect(halvo.perSaleFeeCents).toBe(352);
  });

  it("treats fractional or negative volume as whole sales, never below zero", () => {
    expect(keep(comparePlatforms(2900, 2.9, HALVO), "halvo")).toBe(2 * 2641);
    expect(keep(comparePlatforms(2900, -3, HALVO), "halvo")).toBe(0);
  });
});

describe("stanCrossoverSales", () => {
  it("is 20 sales a month at $29 — the $580 figure", () => {
    expect(stanCrossoverSales(2900, HALVO)).toBe(20);
  });

  it("rounds up, since the 20th sale is the one that tips it", () => {
    // 5% of $15 = 75¢ → 2900 / 75 = 38.67 → 39
    expect(stanCrossoverSales(1500, HALVO)).toBe(39);
  });

  it("has no crossover for a free product", () => {
    expect(stanCrossoverSales(0, HALVO)).toBeNull();
  });
});
