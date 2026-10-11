import { describe, it, expect } from "vitest";
import { buildPurchaseEmail, FINAL_SALE_CONFIRMATION } from "@/lib/purchase-email";
import { CURRENCY_SYMBOL } from "@/lib/site";

describe("buildPurchaseEmail", () => {
  it("includes the product name and download link in subject/html/text", () => {
    const result = buildPurchaseEmail({
      productName: "Invoice Tracker",
      downloadPageUrl: "https://halvo.io/success?id=abc-123",
    });
    expect(result.subject).toContain("Invoice Tracker");
    expect(result.html).toContain("https://halvo.io/success?id=abc-123");
    expect(result.html).toContain("Invoice Tracker");
    expect(result.text).toContain("https://halvo.io/success?id=abc-123");
  });

  it("links to our own success page, not a raw storage URL — signed URLs expire, /success re-signs on every visit", () => {
    const result = buildPurchaseEmail({
      productName: "Ebook",
      downloadPageUrl: "https://halvo.io/success?id=xyz",
    });
    expect(result.html).not.toContain("supabase.co/storage");
    expect(result.html).toContain("/success?id=");
  });

  it("shows a paid amount as a receipt line when given", () => {
    const result = buildPurchaseEmail({
      productName: "Ebook",
      downloadPageUrl: "https://halvo.io/success?id=xyz",
      amountCents: 1999,
    });
    expect(result.html).toContain(`${CURRENCY_SYMBOL}19.99`);
    expect(result.text).toContain(`${CURRENCY_SYMBOL}19.99`);
  });

  it("shows Free for a zero-amount claim", () => {
    const result = buildPurchaseEmail({
      productName: "Lead magnet",
      downloadPageUrl: "https://halvo.io/success?id=xyz",
      amountCents: 0,
    });
    expect(result.text).toContain("Free");
    expect(result.html).not.toContain(`${CURRENCY_SYMBOL}0.00`);
  });

  it("omits the receipt line entirely when no amount is given", () => {
    const result = buildPurchaseEmail({
      productName: "Ebook",
      downloadPageUrl: "https://halvo.io/success?id=xyz",
    });
    expect(result.text).not.toContain("$");
    expect(result.text).not.toContain("Free");
  });

  it("confirms the withdrawal waiver on paid receipts (required for EU final-sale digital content)", () => {
    const result = buildPurchaseEmail({ productName: "Ebook", downloadPageUrl: "https://halvo.io/success?id=x", amountCents: 1999 });
    expect(result.html).toContain(FINAL_SALE_CONFIRMATION);
    expect(result.text).toContain(FINAL_SALE_CONFIRMATION);
    expect(FINAL_SALE_CONFIRMATION).toMatch(/14-day right of withdrawal/);
    expect(FINAL_SALE_CONFIRMATION).toMatch(/faulty, missing or not as described/);
  });

  it("leaves the waiver out of free claims, where nothing was paid", () => {
    const result = buildPurchaseEmail({ productName: "Lead magnet", downloadPageUrl: "https://halvo.io/success?id=x", amountCents: 0 });
    expect(result.text).not.toContain(FINAL_SALE_CONFIRMATION);
  });

  it("escapes the seller-written product name in the HTML", () => {
    const result = buildPurchaseEmail({ productName: '<img src=x onerror="a">Kit', downloadPageUrl: "https://halvo.io/success?id=x" });
    expect(result.html).not.toContain("<img src=x");
    expect(result.html).toContain("&lt;img src=x");
  });
});
