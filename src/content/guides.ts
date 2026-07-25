import { COMMISSION_PERCENT } from "@/lib/commission-math";
import { BRAND_NAME } from "@/lib/site";
import type { ContentBlock } from "@/content/blocks";

// Guides are documentation for people already using the product. Content is
// structured blocks (see content/blocks.ts) rather than markdown so it stays
// typed and needs no extra build pipeline. The `pricing` block renders the live
// PricingTiers component, so fee documentation can never drift away from
// plans.ts — the single source of truth.
export type Guide = {
  slug: string;
  title: string;
  description: string;
  minutes: number;
  category: "Getting started" | "Getting paid" | "Growing sales";
  body: ContentBlock[];
};

export const GUIDES: Guide[] = [
  {
    slug: "your-first-product",
    title: "Your first product, start to finish",
    description: `Go from a brand-new ${BRAND_NAME} account to a live product link you can share — in about five minutes.`,
    minutes: 5,
    category: "Getting started",
    body: [
      {
        type: "p",
        text: "You need three things to start selling: a storefront handle, a product, and the file you're delivering. Here's the whole path.",
      },
      { type: "h2", text: "1. Pick your storefront handle" },
      {
        type: "p",
        text: "Your handle is your public store address. If you pick “ana”, your storefront lives at halvo.io/u/ana and lists everything you sell. You can set it from the top of your dashboard.",
      },
      { type: "h2", text: "2. Create the product" },
      {
        type: "steps",
        items: [
          "Click New product on your dashboard.",
          "Give it a name, a short description, and a price.",
          "Hit Create product. It's saved as a draft for now.",
        ],
      },
      {
        type: "note",
        text: "A new product starts as a Draft on purpose. It has no public link yet, so nobody can buy something you haven't finished setting up.",
      },
      { type: "h2", text: "3. Attach the file — this publishes it" },
      {
        type: "p",
        text: "Open the product and upload the file your buyer receives: the PDF, the zip, the video, whatever it is. The moment the first file lands, the product publishes and gets its public link.",
      },
      {
        type: "p",
        text: "That's deliberate. A product can never be live with nothing behind it, so a buyer can't pay and end up with an empty download.",
      },
      { type: "h2", text: "4. Connect Stripe so you can actually be paid" },
      {
        type: "p",
        text: "Until Stripe is connected, your product page shows a polite “not available yet” notice instead of a checkout. Connecting takes a few minutes — see the guide on connecting Stripe.",
      },
      { type: "h2", text: "5. Share the link" },
      {
        type: "p",
        text: "Nothing sells until someone sees it. Use the share button on the product to copy your link, or grab a buy button to drop on your own site. Put it wherever your audience already is.",
      },
    ],
  },
  {
    slug: "connecting-stripe",
    title: "Connecting Stripe to get paid",
    description: "What Stripe needs from you, how long it takes, and why your money never sits in our account.",
    minutes: 4,
    category: "Getting paid",
    body: [
      {
        type: "p",
        text: `${BRAND_NAME} doesn't hold your money. Payments run through Stripe Connect, and your share is routed to your own Stripe account automatically as part of the payment itself.`,
      },
      { type: "h2", text: "What you'll need" },
      {
        type: "ul",
        items: [
          "A government ID (Stripe is legally required to verify who you are)",
          "Your bank account details, for payouts",
          "Your address, and a tax ID if you're registered as a business",
        ],
      },
      {
        type: "note",
        text: "This is Stripe's identity check, not ours — the same one every legitimate payment processor has to run. We never see your bank details.",
      },
      { type: "h2", text: "How to connect" },
      {
        type: "steps",
        items: [
          "On your dashboard, find the Payouts card and click Connect Stripe.",
          "Complete Stripe's onboarding form (usually a few minutes).",
          "You'll be sent back automatically. The card will show as connected.",
        ],
      },
      { type: "h2", text: "When do I get the money?" },
      {
        type: "p",
        text: "Your share lands in your Stripe balance at the moment of the sale, then Stripe pays it out to your bank on your payout schedule — typically every couple of days once your account is fully verified.",
      },
      {
        type: "p",
        text: "If checkout says a product isn't available yet, the usual cause is that Stripe onboarding hasn't been finished. Open the Payouts card and check for anything Stripe still needs.",
      },
    ],
  },
  {
    slug: "sharing-and-embedding",
    title: "Sharing your product and embedding a buy button",
    description: "Your link, a buy button for your own site, and an embeddable checkout — plus where to actually put them.",
    minutes: 3,
    category: "Growing sales",
    body: [
      {
        type: "p",
        text: "Every published product has one shareable link. Click the share icon on the product in your dashboard to copy it, along with two ready-made snippets.",
      },
      { type: "h2", text: "The three options" },
      {
        type: "ul",
        items: [
          "Direct link — paste it anywhere: a bio, a DM, an email, a video description.",
          "Buy button — a snippet you drop into your own website's HTML.",
          "Embedded checkout — an iframe so buyers never leave your page.",
        ],
      },
      { type: "h2", text: "Where to put it" },
      {
        type: "ul",
        items: [
          "The link in your social bio, so it's always reachable",
          "The end of your newsletter, where people already trust you",
          "Your own site's page about the thing you're selling",
          "A reply to anyone who asks about your work",
        ],
      },
      {
        type: "note",
        text: "Your storefront (halvo.io/u/your-handle) lists everything you sell in one place — useful when you have more than one product.",
      },
    ],
  },
  {
    slug: "fees-and-payouts",
    title: "Fees and payouts, explained plainly",
    description: "Exactly what comes out of a sale, who takes what, and what lands in your account.",
    minutes: 4,
    category: "Getting paid",
    body: [
      {
        type: "p",
        text: "Two things come out of every sale: Stripe's payment processing fee, and our platform fee. Nothing else, and nothing hidden.",
      },
      { type: "h2", text: "Current plans" },
      { type: "pricing" },
      { type: "h2", text: "A worked example" },
      {
        type: "p",
        text: "Say you're on Creator and you sell a $49 template. Our platform fee comes off the sale, Stripe takes its processing cut, and the rest is transferred straight into your own Stripe account — usually within seconds of the payment clearing.",
      },
      { type: "h2", text: "Why there's a fixed few cents as well as a percentage" },
      {
        type: "p",
        text: "Card processing has a flat cost per transaction on top of a percentage. On a $3 sale a percentage alone wouldn't even cover it, so the fee has a small fixed part. It's the same reason every payment processor prices this way.",
      },
      {
        type: "note",
        text: "Upgrading lowers your percentage. If you sell regularly, the plan usually pays for itself — the Plan card on your dashboard shows what you're currently paying.",
      },
    ],
  },
  {
    slug: "discounts-and-coupons",
    title: "Running discounts and coupon codes",
    description: "Create a code, decide what it takes off, and switch it off when the promotion ends.",
    minutes: 3,
    category: "Growing sales",
    body: [
      {
        type: "p",
        text: "Discount codes are on the Discounts page of your dashboard. A code can take off a percentage of the price, and buyers enter it at checkout.",
      },
      { type: "h2", text: "Creating one" },
      {
        type: "steps",
        items: [
          "Open Discounts from the dashboard menu.",
          "Enter a code — short and memorable, like LAUNCH20.",
          "Set the percentage off, then click Create.",
        ],
      },
      { type: "h2", text: "Turning it off" },
      {
        type: "p",
        text: "Every code can be deactivated without deleting it, so you keep the record of how many times it was used. Deactivate rather than delete when a promotion ends.",
      },
      {
        type: "note",
        text: "Discounts are verified on our servers at checkout, not in the browser — so a code can't be edited or reused beyond its limits by anyone poking at the page.",
      },
    ],
  },
  {
    slug: "affiliate-program",
    title: "How the affiliate program works",
    description: `Earn ${COMMISSION_PERCENT}% on sales you refer — and understand what happens when someone refers one of yours.`,
    minutes: 3,
    category: "Growing sales",
    body: [
      {
        type: "p",
        text: `You can earn ${COMMISSION_PERCENT}% on any sale that comes through your affiliate link. Generate links from the Affiliate page in your dashboard.`,
      },
      { type: "h2", text: "It works in both directions" },
      {
        type: "p",
        text: `The commission is taken out of the sale itself at checkout, exactly as any affiliate program works. So you earn ${COMMISSION_PERCENT}% on sales you refer — and when one of your own products sells through someone else's affiliate link, ${COMMISSION_PERCENT}% of that sale goes to them and the rest is paid out to you.`,
      },
      {
        type: "note",
        text: "Any sale that came through an affiliate link is marked on your dashboard with the exact amount deducted, so a payout is never a surprise.",
      },
      { type: "h2", text: "Two kinds of link" },
      {
        type: "ul",
        items: [
          "A product link promotes one specific product.",
          `A platform link points at ${BRAND_NAME} generally and earns on what the person you referred buys.`,
        ],
      },
    ],
  },
  {
    slug: "refunds-and-chargebacks",
    title: "Refunds, disputes and chargebacks",
    description: "How refunds work on digital goods, what buyers agree to, and how you're protected if a payment is disputed.",
    minutes: 5,
    category: "Getting paid",
    body: [
      {
        type: "p",
        text: "Digital products can't be handed back, which makes refunds different from physical goods. Here's exactly how it works.",
      },
      { type: "h2", text: "Buyers agree the sale is final" },
      {
        type: "p",
        text: "Before paying, every buyer must tick a box confirming they understand the product is delivered instantly and that the sale is final once downloaded. That agreement is recorded with a timestamp against the order.",
      },
      { type: "h2", text: "You control refunds" },
      {
        type: "p",
        text: "Buyers cannot refund themselves. You issue a refund from your dashboard if you choose to. When you do, the amount is returned to the buyer and their download access is revoked immediately.",
      },
      {
        type: "note",
        text: "A refund comes out of your payout for that sale, since it's your sale being reversed. Platform fees on a refunded sale aren't returned — standard practice, and it covers the processing cost that the card networks keep either way.",
      },
      { type: "h2", text: "If a buyer disputes a payment" },
      {
        type: "p",
        text: "A chargeback is when a buyer goes to their bank instead of to you. While a dispute is open, that order's downloads are suspended and it's flagged on your dashboard.",
      },
      {
        type: "p",
        text: "We record evidence automatically to help win these: the buyer's final-sale agreement, and a log of every download with time, IP address and device. If the dispute is resolved in your favour, access is restored and nothing changes for you.",
      },
      { type: "h2", text: "Reducing refunds in the first place" },
      {
        type: "ul",
        items: [
          "Describe exactly what's included — most refund requests are unmet expectations",
          "Use a clear cover image so buyers know what they're getting",
          "Add a support email in Settings so people ask you before they ask their bank",
        ],
      },
    ],
  },
  {
    slug: "add-a-buy-button-to-your-site",
    title: "Add a Buy button to your own site",
    description: `Sell from your Webflow, Framer, WordPress, Ghost or Carrd site with a ${BRAND_NAME} button that opens checkout right on the page.`,
    minutes: 3,
    category: "Growing sales",
    body: [
      {
        type: "p",
        text: "Your product link works everywhere. But on a site you control, you can do better than a link: a Buy button that opens checkout in a popup, so your visitor pays without ever leaving your page. Higher intent, fewer drop-offs.",
      },
      { type: "h2", text: "Copy the button" },
      {
        type: "steps",
        items: [
          "On your dashboard, open the product and click Share.",
          "Copy the block labelled “Buy button — opens checkout over your site (recommended)”.",
          "Paste it wherever your site accepts custom HTML.",
        ],
      },
      {
        type: "p",
        text: "The block is just a link plus a small script. It looks like this — your dashboard fills in your real product and price:",
      },
      {
        type: "code",
        code:
          '<a href="https://halvo.io/p/your-product"\n   data-halvo-checkout="your-product"\n   style="display:inline-block;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Buy — $19.00</a>\n<script src="https://halvo.io/embed.js" async></script>',
      },
      {
        type: "note",
        text: "It's a real link first. If a visitor has JavaScript turned off, the button still works — it just opens your checkout page normally instead of in a popup. Nothing breaks.",
      },
      { type: "h2", text: "Where to paste it" },
      {
        type: "ul",
        items: [
          "Webflow — add an Embed element and paste the block inside.",
          "Framer — add an Embed / HTML component and paste it in.",
          "WordPress — add a Custom HTML block.",
          "Ghost — add an HTML card (the + menu in the editor).",
          "Carrd — add an Embed element (Code type).",
          "Any hand-built page — paste it straight into your HTML.",
        ],
      },
      {
        type: "note",
        text: "Notion and most link-in-bio tools don't allow custom scripts. There, use the plain Direct link from the Share panel — it opens your full checkout page and works exactly the same for the buyer.",
      },
      { type: "h2", text: "Two small options" },
      {
        type: "ul",
        items: [
          "Add data-halvo-target=\"blank\" to the link to open checkout in a new tab instead of a popup.",
          "Reuse the same one script line for every button on a page — you only need it once, even with several products.",
        ],
      },
      { type: "h2", text: "Will the popup and wallets work?" },
      {
        type: "p",
        text: "Yes. The popup is your real checkout page, so Apple Pay, Google Pay and card all work inside it, payment still routes to your own Stripe, and delivery is instant. Buyers can close the popup any time with Escape, the ✕, or by clicking outside it.",
      },
    ],
  },
];

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
