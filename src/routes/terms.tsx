import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { BRAND_NAME, BRAND_EMAIL, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: `Terms of Service — ${BRAND_NAME}` },
      { name: "description", content: `The terms for using ${BRAND_NAME} to buy and sell digital products.` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/terms` }],
  }),
  component: TermsPage,
});

// Bump this whenever the terms change — it used to print today's date on every visit.
const TERMS_UPDATED = "2026-10-11";

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>Last updated: {TERMS_UPDATED}</p>

      <h2>1. Using {BRAND_NAME}</h2>
      <p>
        {BRAND_NAME} is a platform that lets creators sell digital products directly to buyers. By creating an account
        you agree to these terms and to use the platform lawfully. You must be able to form a binding contract and, if
        selling, be able to enter a payments agreement with Stripe.
      </p>

      <h2>2. Payments and fees</h2>
      <ul>
        <li>Payments are processed by Stripe. Sellers connect their own Stripe account and are paid into it directly.</li>
        <li>
          Each sale is made by the seller, not by {BRAND_NAME}. The seller is the merchant of record: their business name
          appears on the buyer's card statement, and the contract for the product is between the buyer and the seller.{" "}
          {BRAND_NAME} provides the storefront, checkout and delivery as a service to the seller.
        </li>
        <li>
          {BRAND_NAME} charges a platform fee on each sale, as shown on the <Link to="/pricing">Pricing</Link> page.
          The fee that applies depends on the seller's plan.
        </li>
        <li>
          Subscriptions to paid plans renew automatically until cancelled. You can cancel any time from your billing
          settings; access continues until the end of the paid period.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You keep ownership of everything you upload. You're responsible for having the rights to sell it and for the
        accuracy of your product descriptions and prices. You grant {BRAND_NAME} the limited licence needed to host,
        display and deliver your products to your buyers.
      </p>

      <h2>4. What you may not sell or do</h2>
      <ul>
        <li>Anything illegal, or content you don't have the rights to distribute.</li>
        <li>Malware, or files intended to harm or deceive buyers.</li>
        <li>Anything Stripe's rules prohibit (see Stripe's restricted-businesses list).</li>
        <li>Attempts to defraud buyers, evade fees, or abuse the platform's systems.</li>
      </ul>

      <h2>5. Sellers: delivery, refunds and buyer data</h2>
      <ul>
        <li>You must deliver what your product page describes.</li>
        <li>
          Every product on {BRAND_NAME} is sold under the same <Link to="/refund-policy">refund policy</Link>: sales
          are final, because buyers ask for immediate access and acknowledge losing their 14-day right of withdrawal
          at checkout. You must still fix or refund a file that is faulty, missing or not as described, and a duplicate
          charge. Don't promise buyers a different refund policy on your product pages or elsewhere.
        </li>
        <li>
          You act as the data controller for your buyers' information and must use it lawfully — for example, only
          contacting buyers about their purchase unless they've agreed to marketing. See our{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </li>
      </ul>

      <h2>6. Taxes</h2>
      <ul>
        <li>
          Sellers are solely responsible for determining, charging, collecting, reporting and paying any sales tax, VAT,
          GST, income tax or other tax that applies to their sales, including registering with tax authorities where
          required. Prices you set are the prices buyers pay; {BRAND_NAME} doesn't add, calculate or remit tax on your
          sales.
        </li>
        <li>
          {BRAND_NAME} isn't a tax adviser. If you're unsure what applies to you — for example EU VAT on digital products
          sold to consumers — ask a qualified accountant.
        </li>
        <li>
          {BRAND_NAME}'s own platform fee and plan subscriptions are services we provide to you, and any tax on those
          is handled by {BRAND_NAME}.
        </li>
      </ul>

      <h2>7. Buyers</h2>
      <p>
        When you buy, you get access to the digital product and, where enabled, a licence key. Refunds are governed by
        the seller's stated policy plus any rights you have under law. Chargebacks and disputes are handled through
        Stripe; abusive chargebacks may result in loss of access.
      </p>
      <ul>
        <li>
          <strong>Memberships</strong> renew automatically at the price shown when you joined, until you cancel. You
          can cancel any time from the billing link in your email and keep access until the end of the period you've
          paid for.
        </li>
        <li>
          <strong>Payment plans</strong> charge the stated number of payments automatically, then stop. Once every
          payment is made, the product is yours like any other purchase.
        </li>
        <li>
          If a recurring payment fails, you keep access for 7 days while it's retried and you can update your card.
          After that, access pauses until the payment goes through.
        </li>
      </ul>

      <h2>8. Availability and liability</h2>
      <p>
        {BRAND_NAME} is provided "as is". We work to keep it running but don't guarantee uninterrupted or error-free
        service. To the extent the law allows, {BRAND_NAME} isn't liable for indirect or consequential losses, or for
        disputes between buyers and sellers over the products themselves.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or close accounts that violate these terms or applicable law. You can close your account at any
        time; some records may be retained as described in the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms as the service evolves. Material changes will be reflected by the "last updated" date
        above; continuing to use {BRAND_NAME} means you accept the current terms.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
