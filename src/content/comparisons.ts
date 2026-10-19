import { UNIVERSAL_FEE_FIXED_CENTS, UNIVERSAL_FEE_PCT } from "@/lib/plans";
import { comparePlatforms, stanCrossoverSales } from "@/lib/platform-fees";

// Honest head-to-heads. Each page says where the other platform is the better
// choice — that candour is the point, and it's what makes the rest believable.
//
// Every number here is computed from platform-fees.ts and Halvo's live rate
// in plans.ts, never typed in, so the copy can't drift from the calculator.
// Competitor facts were checked against their own pages on the date in
// platform-fees.ts (CHECKED_ON); Stan's plan contents come from its help
// centre article "Creator vs. Creator Pro".

const HALVO = { pct: UNIVERSAL_FEE_PCT, fixedCents: UNIVERSAL_FEE_FIXED_CENTS };
const PCT = `${Math.round(UNIVERSAL_FEE_PCT * 100)}%`;

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const usd2 = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// One $29 sale: how much more Halvo leaves than Gumroad's direct sales.
const ONE_SALE = comparePlatforms(2900, 1, HALVO);
const GUMROAD_GAP = ONE_SALE.find((r) => r.id === "halvo")!.monthlyKeepCents - ONE_SALE.find((r) => r.id === "gumroad")!.monthlyKeepCents;

// Where Stan Store's flat fees overtake Halvo's percentage.
const STAN_SALES_AT_29 = stanCrossoverSales(2900, HALVO) ?? 0;
const STAN_CREATOR_LINE = UNIVERSAL_FEE_PCT > 0 ? Math.round(2900 / UNIVERSAL_FEE_PCT) : 0;
const STAN_PRO_LINE = UNIVERSAL_FEE_PCT > 0 ? Math.round(9900 / UNIVERSAL_FEE_PCT) : 0;

export type Point = { title: string; body: string };

export type Comparison = {
  slug: string;
  competitor: string;
  metaDescription: string;
  intro: string;
  preset: { price: number; sales: number };
  halvoBetter: Point[];
  theyreBetter: Point[];
  verdict: string;
  sources: { label: string; url: string }[];
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "gumroad",
    competitor: "Gumroad",
    metaDescription: `Gumroad takes 10% + 50¢ plus card processing, or 30% through Discover. Halvo takes ${PCT}. An honest comparison, including where Gumroad is the better choice.`,
    intro: `Gumroad takes 10% + 50¢ of every direct sale, with card processing charged on top, and 30% of anything sold through its Discover marketplace. Halvo takes ${PCT}. Here is the whole picture — including where Gumroad is the better choice.`,
    preset: { price: 29, sales: 5 },
    halvoBetter: [
      {
        title: "Half the platform fee",
        body: `${PCT} of each sale, against Gumroad's 10% + 50¢. On a $29 product that's ${usd2(GUMROAD_GAP)} more for you every time it sells, after card processing on both.`,
      },
      {
        title: "No bigger cut for marketplace sales",
        body: `Gumroad takes 30% of a sale that comes through Discover. Halvo charges the same ${PCT} whether a buyer found you through your own link or through Halvo's Discover page.`,
      },
      {
        title: "Paid into your own Stripe",
        body: "The buyer pays into your Stripe account directly. Every payment is in your own Stripe dashboard, and payouts follow Stripe's schedule rather than ours.",
      },
    ],
    theyreBetter: [
      {
        title: "It handles your tax",
        body: "Gumroad is merchant of record: it collects and remits sales tax and VAT for you. Halvo doesn't, so your tax stays yours. With a lot of international buyers, that can be worth more than the difference in fees.",
      },
      {
        title: "A big marketplace already",
        body: "Gumroad's Discover has years of buyers browsing it. Halvo's is new and small, so for now expect to bring your own traffic.",
      },
      {
        title: "A long track record",
        body: "Gumroad has been running since 2011. Halvo is in early access.",
      },
    ],
    verdict:
      "If most of your sales come from your own audience — a newsletter, Instagram, YouTube — and tax handling isn't what decides it for you, Halvo leaves you more of every sale. You don't have to move everything at once: put one product on Halvo and send your next launch there.",
    sources: [
      { label: "Gumroad pricing", url: "https://gumroad.com/pricing" },
      { label: "Gumroad's fees (help centre)", url: "https://gumroad.com/help/article/66-gumroads-fees" },
    ],
  },
  {
    slug: "stan-store",
    competitor: "Stan Store",
    metaDescription: `Stan Store charges $29 a month whether you sell or not. Halvo takes ${PCT} of what you sell. Exactly where the line falls, and what each one includes.`,
    intro: `Stan Store charges $29 a month whether you sell anything or not. Halvo takes ${PCT} of what you sell, and nothing in a month you don't. Which costs less depends on how much you sell — so here is exactly where the line falls.`,
    preset: { price: 29, sales: 5 },
    halvoBetter: [
      {
        title: "Nothing to pay before you sell",
        body: `A month with no sales costs $0 on Halvo and $29 on Stan Store. At $29 a product, Halvo stays cheaper until you're selling about ${STAN_SALES_AT_29} a month — roughly ${usd(STAN_CREATOR_LINE)} in sales.`,
      },
      {
        title: "Discount codes, order bumps and affiliates included",
        body: `All three come with Halvo's one plan. On Stan Store, each needs Creator Pro at $99 a month. If you need them, Halvo stays cheaper than Stan until you're selling about ${usd(STAN_PRO_LINE)} a month.`,
      },
    ],
    theyreBetter: [
      {
        title: "Cheaper once you sell a lot",
        body: `Past about ${usd(STAN_CREATOR_LINE)} a month in sales, Stan's flat $29 costs less than ${PCT}. If you're there and don't need Creator Pro's extras, Stan Store is the cheaper option.`,
      },
      {
        title: "Bookings, courses and community",
        body: "Stan's Creator plan includes calendar booking, a course builder and community features. Halvo sells digital products — it doesn't do appointments or courses.",
      },
      {
        title: "Instagram automation",
        body: "Stan's AutoDM replies to Instagram comments and messages automatically. Halvo has nothing like it.",
      },
    ],
    verdict: `If you're starting out, selling a handful of products a month, or you need discount codes without paying $99 a month, Halvo costs less. If you're past about ${usd(STAN_CREATOR_LINE)} a month, or you sell coaching calls and courses more than files, Stan Store is the better fit. Neither one handles your sales tax.`,
    sources: [{ label: "Stan Store: Creator vs. Creator Pro", url: "https://help.stan.store/article/31-creator-vs-creator-pro" }],
  },
];

export function findComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
