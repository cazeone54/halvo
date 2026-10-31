import { describe, it, expect } from "vitest";
import {
  buildProductLink,
  buildButtonSnippet,
  buildIframeSnippet,
  buildOverlaySnippet,
  escapeHtml,
} from "@/lib/share-snippets";

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
    expect(html).toContain("€19.00");
    expect(html).not.toContain("$");
    expect(html).toMatch(/^<a /);
  });

  it("doesn't promise a price on a pay-what-you-want product", () => {
    const html = buildButtonSnippet(baseUrl, { ...product, priceCents: 0, payWhatYouWant: true });
    expect(html).toContain("Buy Invoice Tracker — name your price");
    expect(html).not.toContain("Free");
  });

  it("says Get … Free for a free product, not Buy … 0.00", () => {
    const html = buildButtonSnippet(baseUrl, { ...product, priceCents: 0 });
    expect(html).toContain("Get Invoice Tracker — Free");
    expect(html).not.toContain("Buy");
    expect(html).not.toContain("0.00");
  });
});

describe("buildIframeSnippet", () => {
  it("embeds the direct product URL as the iframe src", () => {
    const html = buildIframeSnippet(baseUrl, product);
    expect(html).toContain('src="https://halvo.io/p/invoice-tracker-ab12"');
    expect(html).toMatch(/^<iframe /);
  });

  it("delegates the payment permission so wallets work inside the iframe", () => {
    expect(buildIframeSnippet(baseUrl, product)).toContain('allow="payment"');
  });
});

describe("buildOverlaySnippet", () => {
  it("carries the checkout hook, the product link, and the loader script", () => {
    const html = buildOverlaySnippet(baseUrl, product);
    expect(html).toContain('data-halvo-checkout="invoice-tracker-ab12"');
    expect(html).toContain('href="https://halvo.io/p/invoice-tracker-ab12"');
    expect(html).toContain('<script src="https://halvo.io/embed.js" async></script>');
  });

  it("stays a real link so it still works with no JavaScript", () => {
    expect(buildOverlaySnippet(baseUrl, product)).toMatch(/^<a /);
  });

  it("labels the button the same way as the plain one", () => {
    expect(buildOverlaySnippet(baseUrl, product)).toContain("Buy Invoice Tracker — €19.00");
    expect(buildOverlaySnippet(baseUrl, { ...product, priceCents: 0 })).toContain("Get Invoice Tracker — Free");
  });
});

describe("escapeHtml", () => {
  it("neutralizes characters that would break the copied markup", () => {
    expect(escapeHtml(`Tom & Jerry's "<Big> Kit`)).toBe(
      "Tom &amp; Jerry&#39;s &quot;&lt;Big&gt; Kit",
    );
  });

  it("keeps a product name with special characters from escaping the snippet", () => {
    const html = buildOverlaySnippet(baseUrl, {
      slug: "kit-9",
      name: `Ben & "Pro" <Kit>`,
      priceCents: 4900,
    });
    expect(html).not.toContain('<Kit>');
    expect(html).toContain("Ben &amp; &quot;Pro&quot; &lt;Kit&gt;");
  });
});
