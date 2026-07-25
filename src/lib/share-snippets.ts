// Pure snippet generation — kept separate from the UI so the exact HTML
// output is directly testable.
export type ShareableProduct = {
  slug: string;
  name: string;
  priceCents: number;
};

// Snippets are copied verbatim into the seller's own HTML, so any product name
// with &, <, > or a quote would otherwise break the markup (or worse). Escape
// it. Slugs are already restricted to [a-z0-9-] so they don't need this.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProductLink(baseUrl: string, product: ShareableProduct): string {
  return `${baseUrl}/p/${product.slug}`;
}

export function buildButtonSnippet(baseUrl: string, product: ShareableProduct): string {
  const price = (product.priceCents / 100).toFixed(2);
  const label = escapeHtml(`Buy ${product.name} — $${price}`);
  return `<a href="${buildProductLink(baseUrl, product)}" style="display:inline-block;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-family:sans-serif;font-weight:600;">${label}</a>`;
}

// The recommended snippet: a real link (works with no JS) that embed.js upgrades
// into an overlay so the buyer checks out without leaving the seller's page.
// Both the button and the loader script are returned together so a seller can
// paste one block anywhere that allows custom HTML.
export function buildOverlaySnippet(baseUrl: string, product: ShareableProduct): string {
  const price = (product.priceCents / 100).toFixed(2);
  const label = escapeHtml(`Buy ${product.name} — $${price}`);
  return (
    `<a href="${buildProductLink(baseUrl, product)}" data-halvo-checkout="${product.slug}" ` +
    `style="display:inline-block;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-family:sans-serif;font-weight:600;">${label}</a>\n` +
    `<script src="${baseUrl}/embed.js" async></script>`
  );
}

export function buildIframeSnippet(baseUrl: string, product: ShareableProduct): string {
  const title = escapeHtml(`Buy ${product.name}`);
  return `<iframe src="${buildProductLink(baseUrl, product)}" width="100%" height="700" style="border:none;border-radius:16px;" title="${title}" allow="payment"></iframe>`;
}
