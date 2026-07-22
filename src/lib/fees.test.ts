import { describe, it, expect } from "vitest";
import { MIN_CHARGE_CENTS } from "@/lib/fees";

describe("MIN_CHARGE_CENTS", () => {
  it("matches Stripe's practical USD minimum", () => {
    expect(MIN_CHARGE_CENTS).toBe(50);
  });
});
