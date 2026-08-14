import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { BRAND_NAME, BRAND_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>

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
          You set your own refund policy, and are responsible for honouring it. Buyers are told at checkout that a
          digital purchase is final unless your policy says otherwise.
        </li>
        <li>
          You act as the data controller for your buyers' information and must use it lawfully — for example, only
          contacting buyers about their purchase unless they've agreed to marketing. See our{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </li>
        <li>You're responsible for any taxes on your sales.</li>
      </ul>

      <h2>6. Buyers</h2>
      <p>
        When you buy, you get access to the digital product and, where enabled, a licence key. Refunds are governed by
        the seller's stated policy plus any rights you have under law. Chargebacks and disputes are handled through
        Stripe; abusive chargebacks may result in loss of access.
      </p>

      <h2>7. Availability and liability</h2>
      <p>
        {BRAND_NAME} is provided "as is". We work to keep it running but don't guarantee uninterrupted or error-free
        service. To the extent the law allows, {BRAND_NAME} isn't liable for indirect or consequential losses, or for
        disputes between buyers and sellers over the products themselves.
      </p>

      <h2>8. Termination</h2>
      <p>
        We may suspend or close accounts that violate these terms or applicable law. You can close your account at any
        time; some records may be retained as described in the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms as the service evolves. Material changes will be reflected by the "last updated" date
        above; continuing to use {BRAND_NAME} means you accept the current terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
