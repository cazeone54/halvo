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
});
