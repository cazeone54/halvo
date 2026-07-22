import { describe, it, expect } from "vitest";
import { buildProductLink, buildButtonSnippet, buildIframeSnippet } from "@/lib/share-snippets";

const product = { slug: "invoice-tracker-ab12", name: "Invoice Tracker", priceCents: 1900 };
const baseUrl = "https://halvo.io";

describe("buildProductLink", () => {
  it("builds the direct product URL", () => {
    expect(buildProductLink(baseUrl, product)).toBe("https://halvo.io/p/invoice-tracker-ab12");
  });
});

describe("buildButtonSnippet", () => {
  it("includes the product name, formatted price, and link", () => {
    const html = buildButtonSnippet(baseUrl, product);
    expect(html).toContain("https://halvo.io/p/invoice-tracker-ab12");
    expect(html).toContain("Invoice Tracker");
    expect(html).toContain("$19.00");
    expect(html).toMatch(/^<a /);
  });
});

describe("buildIframeSnippet", () => {
  it("embeds the direct product URL as the iframe src", () => {
    const html = buildIframeSnippet(baseUrl, product);
    expect(html).toContain('src="https://halvo.io/p/invoice-tracker-ab12"');
    expect(html).toMatch(/^<iframe /);
  });
});
