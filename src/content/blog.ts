import type { ContentBlock } from "@/content/blocks";
import { BRAND_NAME } from "@/lib/site";

// Blog posts target people who don't know Halvo yet — they answer the question
// someone actually types into a search box. Guides (src/content/guides.ts) are
// the opposite: documentation for people already using the product.
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  minutes: number;
  date: string; // ISO, used for display + article metadata
  body: ContentBlock[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-sell-digital-products",
    title: "How to sell digital products online (without building a store)",
    description:
      "A practical walkthrough of selling your first digital product — what to sell, how to take payment, and how buyers get their file.",
    minutes: 7,
    date: "2026-07-20",
    body: [
      {
        type: "p",
        text: "Selling a digital product sounds like it needs a website, a shop, and a company. It doesn't. What it actually needs is a file, a price, and a way for someone to pay you and receive it. Everything else is optional.",
      },
      { type: "h2", text: "1. Start with something you've already made" },
      {
        type: "p",
        text: "The best first product is usually something that already exists — a template you built for yourself, notes you keep re-sending to people, a checklist you rely on. If someone has ever asked you for it, that's your product.",
      },
      {
        type: "ul",
        items: [
          "Templates: spreadsheets, Notion setups, design files, contracts",
          "Knowledge: guides, ebooks, cheat sheets, courses",
          "Assets: presets, fonts, icons, sound packs, code",
        ],
      },
      { type: "h2", text: "2. Price it like a product, not an hourly rate" },
      {
        type: "p",
        text: "Digital products have no marginal cost, so price on the value of the outcome, not the hours you spent. Most first products land between $9 and $49. Start near the middle — pricing too low signals low quality and makes the maths miserable.",
      },
      { type: "h2", text: "3. Take payment properly" },
      {
        type: "p",
        text: "This is the part people overthink. You don't need a storefront. You need a checkout that accepts cards and wallets, delivers the file the second payment clears, and pays you out to your own bank account.",
      },
      {
        type: "note",
        text: `That's exactly what ${BRAND_NAME} does: upload the file, set a price, share one link. Payments run on Stripe and your share goes to your own Stripe account.`,
      },
      { type: "h2", text: "4. Put the link where your audience already is" },
      {
        type: "p",
        text: "A product with no traffic doesn't sell, no matter how good the checkout is. Put the link in your social bio, at the end of your newsletter, in the description of anything you publish, and in your reply to anyone who asks about your work.",
      },
      { type: "h2", text: "5. Expect the first sale to be small" },
      {
        type: "p",
        text: "The first sale is a proof point, not a business. What matters is that the loop works end to end: someone paid, they got the file, the money reached you. Once that's true, everything after it is repetition and improvement.",
      },
    ],
  },
  {
    slug: "sell-notion-templates",
    title: "How to sell Notion templates and actually get paid",
    description:
      "Notion templates are one of the easiest digital products to start with. Here's how to package, price and deliver one.",
    minutes: 6,
    date: "2026-07-21",
    body: [
      {
        type: "p",
        text: "Notion templates sell well because the buyer sees the value instantly — they're buying a finished system instead of a blank page. The tricky part isn't building one, it's delivering and charging for it cleanly.",
      },
      { type: "h2", text: "Package it so it's obvious what they get" },
      {
        type: "ul",
        items: [
          "One clear outcome: 'a client CRM', not 'a productivity system'",
          "A cover image showing the actual template, not an abstract graphic",
          "A short list of what's inside — databases, views, automations",
        ],
      },
      { type: "h2", text: "Deliver it as a duplicate link, in a file" },
      {
        type: "p",
        text: "The usual approach is to share your template's public duplicate link. Put that link inside a small PDF or text file along with a short setup note, and sell that file. The buyer downloads it, clicks through, and duplicates the template into their own workspace.",
      },
      {
        type: "note",
        text: "Keep a setup note in the file. Most refund requests on templates are people who couldn't figure out the first step, not people who disliked the template.",
      },
      { type: "h2", text: "Price it between $15 and $49" },
      {
        type: "p",
        text: "Simple single-purpose templates sit around $15–25. Larger systems with multiple linked databases go $39–49. Below $10 you'll spend more effort on support than you earn.",
      },
      { type: "h2", text: "Where template buyers actually come from" },
      {
        type: "ul",
        items: [
          "Short video showing the template being used, not described",
          "A free cut-down version that links to the paid one",
          "Answering questions in communities where people describe the problem your template solves",
        ],
      },
      {
        type: "note",
        text: `With ${BRAND_NAME} you can have the template listed and taking payments in a few minutes — upload the file, set the price, share the link.`,
      },
    ],
  },
  {
    slug: "how-to-price-a-digital-product",
    title: "How to price a digital product",
    description:
      "Why cheap doesn't mean more sales, how to pick a first number, and when to raise it.",
    minutes: 5,
    date: "2026-07-22",
    body: [
      {
        type: "p",
        text: "Pricing is the single easiest thing to change and the thing most people get wrong in the same direction: too low.",
      },
      { type: "h2", text: "Cheap does not mean more sales" },
      {
        type: "p",
        text: "Dropping from $29 to $9 rarely triples your sales — it usually just cuts your revenue per buyer by two thirds while attracting the buyers most likely to ask for refunds. Price signals quality, especially when nobody has heard of you yet.",
      },
      { type: "h2", text: "Pick your first number like this" },
      {
        type: "steps",
        items: [
          "Ask what problem the buyer avoids by having this.",
          "Estimate what that's worth to them in time or money.",
          "Charge roughly a tenth of that, rounded to a clean number.",
        ],
      },
      {
        type: "p",
        text: "A template that saves someone a weekend of work is worth far more than $7. Something that saves an afternoon might be $19. Something that replaces a paid tool can be $49 and up.",
      },
      { type: "h2", text: "Watch out for the small-sale trap" },
      {
        type: "p",
        text: "Every payment carries a fixed processing cost, so very cheap products lose a disproportionate share to fees. A $3 sale can lose a third of its value before anyone touches it. If you want a cheap entry point, make it free and use it to sell something real.",
      },
      { type: "h2", text: "Raise it once you have proof" },
      {
        type: "p",
        text: "After a handful of sales and no complaints, raise the price and watch what happens. If sales hold, you were underpriced. Almost everyone is, at the start.",
      },
    ],
  },
  {
    slug: "digital-products-to-sell-this-weekend",
    title: "9 digital products you can make and sell this weekend",
    description:
      "Concrete, genuinely finishable ideas — with a note on who buys each one and what it's worth.",
    minutes: 5,
    date: "2026-07-23",
    body: [
      {
        type: "p",
        text: "The hardest part of a first product is picking something small enough to finish. Every idea below is realistically a weekend of work.",
      },
      { type: "h2", text: "If you already work in a spreadsheet or Notion" },
      {
        type: "ul",
        items: [
          "A budgeting or invoicing template for freelancers ($19–29)",
          "A content calendar with a real posting workflow ($15–25)",
          "A client onboarding checklist and email scripts ($19–39)",
        ],
      },
      { type: "h2", text: "If you make things visually" },
      {
        type: "ul",
        items: [
          "A pack of photo presets in one consistent style ($12–29)",
          "Social post templates sized for every platform ($19–39)",
          "An icon or illustration set around one theme ($15–35)",
        ],
      },
      { type: "h2", text: "If you know something well" },
      {
        type: "ul",
        items: [
          "A short, blunt guide that solves one specific problem ($9–29)",
          "A swipe file of real examples with commentary ($19–49)",
          "A one-hour recorded walkthrough of a process you use ($29–79)",
        ],
      },
      {
        type: "note",
        text: "Pick the one you could finish tonight if you had to. Momentum matters more than picking the theoretically best idea — you can always make the second one better.",
      },
      { type: "h2", text: "Then get it in front of people" },
      {
        type: "p",
        text: "Finish it, price it, put it behind a link, and share the link. The product isn't real until someone can buy it.",
      },
    ],
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
