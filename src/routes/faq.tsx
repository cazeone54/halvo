import { createFileRoute } from "@tanstack/react-router";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PLAN_LABELS, PLAN_PRICE_USD, PLAN_LIMITS } from "@/lib/plans";
import { COMMISSION_PERCENT } from "@/lib/commission-math";
import { BRAND_NAME } from "@/lib/site";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});

const FAQS: Array<{ group: string; items: Array<{ q: string; a: string }> }> = [
  {
    group: "Pricing & fees",
    items: [
      {
        q: "How much does it cost to sell on " + BRAND_NAME + "?",
        a: `The Free plan takes a ${Math.round(PLAN_LIMITS.free.platformFeePct * 100)}% platform fee on each sale. ${PLAN_LABELS.creator} ($${PLAN_PRICE_USD.creator}/mo) and ${PLAN_LABELS.pro} ($${PLAN_PRICE_USD.pro}/mo) drop that fee to 0% and raise your product/storage limits. Stripe's own processing fee always applies separately.`,
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes — manage or cancel your subscription anytime from the billing portal in your dashboard.",
      },
    ],
  },
  {
    group: "Payments & payouts",
    items: [
      {
        q: "How do I get paid?",
        a: "Connect your Stripe account once from the dashboard. Every sale routes straight to your connected Stripe balance — no manual payout requests.",
      },
      {
        q: "What happens on a refund?",
        a: "Refunding a sale from your dashboard issues a real Stripe refund to the buyer and revokes their download access.",
      },
    ],
  },
  {
    group: "Growth features",
    items: [
      {
        q: "Can I run discount codes?",
        a: "Yes, on Creator and Pro — percent-off or flat-amount coupons, with an optional redemption limit.",
      },
      {
        q: "Is there an affiliate program?",
        a: `Yes, on Creator and Pro — affiliates earn ${COMMISSION_PERCENT}% on any sale tracked through their link, with a 30-day attribution window.`,
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
              <div className="mt-3 flex flex-col gap-4">
                {group.items.map((item) => (
                  <div key={item.q}>
                    <p className="font-medium">{item.q}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
                  </div>
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
