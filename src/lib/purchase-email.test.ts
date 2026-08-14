import { describe, it, expect } from "vitest";
import { buildPurchaseEmail } from "@/lib/purchase-email";

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
    expect(result.html).toContain("$19.99");
    expect(result.text).toContain("$19.99");
  });

  it("shows Free for a zero-amount claim", () => {
    const result = buildPurchaseEmail({
      productName: "Lead magnet",
      downloadPageUrl: "https://halvo.io/success?id=xyz",
      amountCents: 0,
    });
    expect(result.text).toContain("Free");
    expect(result.html).not.toContain("$0.00");
  });

  it("omits the receipt line entirely when no amount is given", () => {
    const result = buildPurchaseEmail({
      productName: "Ebook",
      downloadPageUrl: "https://halvo.io/success?id=xyz",
    });
    expect(result.text).not.toContain("$");
    expect(result.text).not.toContain("Free");
  });
});
