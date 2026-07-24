import { BRAND_NAME } from "@/lib/site";

// One landing page per audience, generated from this file. Aimed at the search
// someone runs *before* they've heard of us ("how do photographers sell
// presets"), which is the acquisition channel a new platform otherwise lacks.
// Adding an audience here creates the page, the nav entry and the sitemap entry.
export type Audience = {
  slug: string;
  noun: string; // "photographers"
  headline: string;
  intro: string;
  sells: string[];
  painPoints: string[];
  proofPoint: string;
};

export const AUDIENCES: Audience[] = [
  {
    slug: "notion-creators",
    noun: "Notion creators",
    headline: "Sell your Notion templates without building a store",
    intro: `You've built something people keep asking for. ${BRAND_NAME} turns it into a link you can share — buyers pay, get the duplicate link instantly, and the money lands in your own Stripe.`,
    sells: ["Dashboards and second-brain systems", "Client CRMs and project trackers", "Budget and invoice templates", "Habit and content planners"],
    painPoints: [
      "Marketplaces take a large cut of every sale, forever",
      "Sharing a duplicate link by hand doesn't scale past a few buyers",
      "No clean way to charge before you hand over access",
    ],
    proofPoint: "Put the duplicate link in a small PDF, upload it, set a price. That's the whole setup.",
  },
  {
    slug: "photographers",
    noun: "photographers",
    headline: "Sell your presets and Lightroom profiles",
    intro: `Your editing style is a product. ${BRAND_NAME} delivers the files the second someone pays, so you're not emailing zip folders at midnight.`,
    sells: ["Lightroom and Camera Raw presets", "LUTs for video", "Print and album templates", "Posing and shot-list guides"],
    painPoints: [
      "Manually sending files to every buyer",
      "Chasing payments over DMs and invoices",
      "Platforms that hold your money for weeks",
    ],
    proofPoint: "Bundle the preset pack as a zip, add a cover image showing before and after, and share one link.",
  },
  {
    slug: "designers",
    noun: "designers",
    headline: "Turn your design files into products that sell while you sleep",
    intro: `You've already built the UI kits, icon sets and templates for client work. ${BRAND_NAME} lets you sell them without spinning up a shop.`,
    sells: ["UI kits and component libraries", "Icon and illustration sets", "Presentation and social templates", "Mockup scenes"],
    painPoints: [
      "Client work stops paying the moment you stop working",
      "Marketplace fees and rigid review queues",
      "Buyers who can't open your source files",
    ],
    proofPoint: "Export in the formats non-designers actually own, include a one-page how-to, and price on the outcome.",
  },
  {
    slug: "writers",
    noun: "writers",
    headline: "Sell your ebooks and guides directly to readers",
    intro: `Keep the relationship with your readers instead of renting it. ${BRAND_NAME} handles checkout and instant delivery — you keep your own Stripe account.`,
    sells: ["Ebooks and short guides", "Swipe files and templates", "Newsletter archives and back catalogues", "Workbooks and worksheets"],
    painPoints: [
      "Retail platforms taking a cut and owning the customer",
      "No way to sell a PDF without a full storefront",
      "Readers who want to buy directly but have no way to",
    ],
    proofPoint: "Offer a free first chapter as a lead magnet, then sell the full book to the list you build.",
  },
  {
    slug: "developers",
    noun: "developers",
    headline: "Sell your code, templates and boilerplates",
    intro: `Ship the starter kit you keep rebuilding. ${BRAND_NAME} takes the payment and delivers the archive instantly, with payouts to your own Stripe.`,
    sells: ["Boilerplates and starter kits", "Component libraries and plugins", "Scripts, configs and CI templates", "Technical guides and courses"],
    painPoints: [
      "Rolling your own checkout and licence delivery",
      "Payment platforms that gate payouts behind reviews",
      "Spending a weekend on billing instead of the product",
    ],
    proofPoint: "Zip the repo, write a clear README of what's inside, and let the link do the selling.",
  },
];

export function findAudience(slug: string): Audience | undefined {
  return AUDIENCES.find((a) => a.slug === slug);
}
