// Starter listings a brand-new seller can pre-fill the create form with, so
// their first look at an empty dashboard shows what a good listing reads like
// instead of a blank form. Nothing is saved until they press Create.
export type ProductExample = {
  key: string;
  label: string;
  name: string;
  description: string;
  price: string;
};

export const PRODUCT_EXAMPLES: readonly ProductExample[] = [
  {
    key: "template",
    label: "Notion template",
    name: "Freelance Client Tracker — Notion Template",
    description:
      "Every client, invoice and deadline in one Notion workspace. Duplicate it in one click, then track projects from first call to final payment without a spreadsheet in sight.\n\nIncludes: client CRM, invoice log with paid/unpaid status, project timeline, and a weekly review page.",
    price: "19",
  },
  {
    key: "guide",
    label: "Ebook / guide",
    name: "The 30-Day Newsletter Launch Plan",
    description:
      "A day-by-day plan for going from zero to your first 500 subscribers — what to write, where to post it, and what to skip.\n\n42-page PDF with checklists and the exact welcome email sequence that converts.",
    price: "12",
  },
  {
    key: "lead-magnet",
    label: "Free lead magnet",
    name: "Pricing Cheat Sheet for Freelancers",
    description:
      "A one-page reference for pricing your work by value instead of by the hour. Free — just leave your email and it's yours.",
    price: "0",
  },
] as const;

export function findProductExample(key: string): ProductExample | undefined {
  return PRODUCT_EXAMPLES.find((e) => e.key === key);
}
