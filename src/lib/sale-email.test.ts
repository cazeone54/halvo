import { describe, it, expect } from "vitest";
import { buildSaleNotificationEmail } from "@/lib/sale-email";

const base = {
  productName: "Freelance Invoice Kit",
  amountCents: 3900,
  dashboardUrl: "https://halvo.io/dashboard",
};

describe("buildSaleNotificationEmail", () => {
  it("marks the first sale differently — it's the moment that earns the subscription", () => {
    const first = buildSaleNotificationEmail({ ...base, isFirstSale: true });
    expect(first.subject).toContain("first sale");
    expect(first.text).toContain("You made your first sale.");
  });

  it("uses a plain subject with the amount for later sales", () => {
    const later = buildSaleNotificationEmail({ ...base, isFirstSale: false });
    expect(later.subject).not.toContain("first sale");
    expect(later.subject).toContain("$39.00");
  });

  it("always includes the amount, the product and a link back to the dashboard", () => {
    for (const isFirstSale of [true, false]) {
      const mail = buildSaleNotificationEmail({ ...base, isFirstSale });
      for (const body of [mail.html, mail.text]) {
        expect(body).toContain("$39.00");
        expect(body).toContain("Freelance Invoice Kit");
        expect(body).toContain("https://halvo.io/dashboard");
      }
    }
  });
});
