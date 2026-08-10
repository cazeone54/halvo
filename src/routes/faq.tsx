import { createFileRoute } from "@tanstack/react-router";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PLAN_LABELS, PLAN_PRICE_USD, PLAN_LIMITS } from "@/lib/plans";
import { COMMISSION_PERCENT } from "@/lib/commission-math";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `FAQ — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Answers about selling on ${BRAND_NAME}: how you get paid, fees, whether you need a company, what you can sell, refunds and more.`,
      },
      { property: "og:title", content: `FAQ — ${BRAND_NAME}` },
      { property: "og:url", content: `${BASE_URL}/faq` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/faq` }],
  }),
  component: FaqPage,
});

// Kept in sync with plans.ts so a fee number here can never drift from reality.
const freeFee = Math.round(PLAN_LIMITS.free.platformFeePct * 100);
const creatorFee = Math.round(PLAN_LIMITS.creator.platformFeePct * 100);
const proFee = Math.round(PLAN_LIMITS.pro.platformFeePct * 100);
const fixedCents = PLAN_LIMITS.free.platformFeeFixedCents;

const FAQS: Array<{ group: string; items: Array<{ q: string; a: string }> }> = [
  {
    group: "Getting started",
    items: [
      {
        q: "Is my money safe? Do you hold it?",
        a: `No — we never hold your money. Every sale is a Stripe payment that goes straight into your own Stripe account, so we can't touch, freeze or delay your balance. ${BRAND_NAME} only collects its small platform fee.`,
      },
      {
        q: "When do I get paid?",
        a: "As soon as a purchase completes, the funds are in your own Stripe balance. Stripe then pays out to your bank on your normal schedule (often every day or two). There are no manual payout requests.",
      },
      {
        q: "Do I need a registered company to start?",
        a: "No. You can start as an individual / sole trader — Stripe accepts individuals, not just companies. You can register a company later, once you're growing, if you want to.",
      },
      {
        q: "What can I sell?",
        a: "Any digital file: ebooks, templates, presets, courses, music, Notion docs, software, and more. You can also give a file away as a free lead magnet — buyers just leave an email, and you don't even need Stripe connected for that.",
      },
    ],
  },
  {
    group: "Pricing & fees",
    items: [
      {
        q: "How much does it cost to sell on " + BRAND_NAME + "?",
        a: `A small platform fee per sale: ${freeFee}% on Free, ${creatorFee}% on ${PLAN_LABELS.creator} ($${PLAN_PRICE_USD.creator}/mo), and ${proFee}% on ${PLAN_LABELS.pro} ($${PLAN_PRICE_USD.pro}/mo), plus a flat ${fixedCents}¢. Paid plans lower the fee and raise your product, storage and file-size limits.`,
      },
      {
        q: "Is there a separate Stripe fee on top?",
        a: "No — not to you. We cover Stripe's card-processing cost out of our fee, so the amount you see is the amount that reaches your Stripe. (Try the calculator on the pricing page.)",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes — manage or cancel your subscription anytime from the billing portal in your dashboard. There's no lock-in, and you keep your products and customer list.",
      },
    ],
  },
  {
    group: "Buyers & delivery",
    items: [
      {
        q: "How do buyers get their file?",
        a: "Instantly. The download unlocks the second payment succeeds, and the link is emailed to the buyer too so they can come back to it.",
      },
      {
        q: "Do you keep my customers?",
        a: "No. Every buyer's email is yours — you can see and export your full customer list any time. We never get between you and your audience.",
      },
      {
        q: "What happens on a refund?",
        a: "Refunding a sale from your dashboard issues a real Stripe refund to the buyer and revokes their download access.",
      },
      {
        q: "What about chargebacks?",
        a: "If a buyer disputes a payment, that order's download is suspended and it's flagged on your dashboard. We automatically record the buyer's final-sale agreement and a download log (time, IP, device) as evidence to help win it.",
      },
    ],
  },
  {
    group: "Growth features",
    items: [
      {
        q: "Can I run discount codes?",
        a: "Yes, on Creator and Pro — percent-off coupons, which you can activate or deactivate any time.",
      },
      {
        q: "Is there an affiliate program?",
        a: `Yes, on Creator and Pro — affiliates earn ${COMMISSION_PERCENT}% on any sale tracked through their link, with a 30-day attribution window.`,
      },
      {
        q: "Can I sell from my own website?",
        a: "Yes — copy a Buy button from any product's Share panel and paste it into your own site (Webflow, Framer, WordPress, Carrd…). Buyers check out in a popup without leaving your page.",
      },
    ],
  },
];

function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Frequently asked questions
        </h1>
        <div className="mt-8 flex flex-col gap-8">
          {FAQS.map((group) => (
            <div key={group.group}>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">{group.group}</h2>
              <div className="mt-3 flex flex-col divide-y divide-border/60 rounded-lg border">
                {group.items.map((item) => (
                  <details key={item.q} className="group px-4 py-3 open:bg-muted/30">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-medium marker:content-none">
                      {item.q}
                      <span className="ml-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
