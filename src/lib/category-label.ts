// How a product category reads on a filter button. Sellers type categories
// freely and in lower case, and capitalising them with CSS turned "ai" into
// "Ai" — so short words that are really initials get spelled the way they're
// written everywhere else.
const SPELLED: Record<string, string> = {
  ai: "AI",
  api: "API",
  crm: "CRM",
  diy: "DIY",
  lut: "LUT",
  luts: "LUTs",
  pdf: "PDF",
  saas: "SaaS",
  seo: "SEO",
  svg: "SVG",
  ui: "UI",
  ux: "UX",
  "3d": "3D",
};

export function categoryLabel(category: string): string {
  return category
    .trim()
    .split(/(\s+|-|\/)/)
    .map((word) => {
      const spelled = SPELLED[word.toLowerCase()];
      if (spelled) return spelled;
      // A word the seller already capitalised their way ("iPhone") stays theirs.
      return word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join("");
}
