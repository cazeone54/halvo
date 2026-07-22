// Pure snippet generation — kept separate from the UI so the exact HTML
// output is directly testable.
export type ShareableProduct = {
  slug: string;
  name: string;
  priceCents: number;
};

export function buildProductLink(baseUrl: string, product: ShareableProduct): string {
  return `${baseUrl}/p/${product.slug}`;
}

export function buildButtonSnippet(baseUrl: string, product: ShareableProduct): string {
  const price = (product.priceCents / 100).toFixed(2);
  const label = `Buy ${product.name} — $${price}`;
  return `<a href="${buildProductLink(baseUrl, product)}" style="display:inline-block;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-family:sans-serif;font-weight:600;">${label}</a>`;
}

export function buildIframeSnippet(baseUrl: string, product: ShareableProduct): string {
  return `<iframe src="${buildProductLink(baseUrl, product)}" width="100%" height="700" style="border:none;border-radius:16px;" title="Buy ${product.name}"></iframe>`;
}
