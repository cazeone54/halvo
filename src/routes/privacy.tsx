import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { BRAND_NAME, BRAND_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details you give us: your email, display name, storefront handle, bio and avatar.</li>
        <li>The products, files and images you upload to sell.</li>
        <li>
          Transaction records needed to deliver purchases and process payouts: buyer email, amounts, and Stripe
          identifiers. We never see or store full card numbers — payment details go directly to Stripe.
        </li>
        <li>Basic technical logs (e.g. download events) used to run the service and defend against fraud/chargebacks.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To operate {BRAND_NAME}: authenticating you, processing payments through Stripe, delivering downloads and
        license keys, showing you your own sales and analytics, and emailing purchase confirmations and receipts. We
        don't sell your personal data.
      </p>

      <h2>Legal bases (GDPR)</h2>
      <ul>
        <li>
          <strong>Performance of a contract</strong> — to give you the account, storefront and payments you signed up
          for.
        </li>
        <li>
          <strong>Legal obligation</strong> — to keep transaction and tax records for the period the law requires.
        </li>
        <li>
          <strong>Legitimate interests</strong> — to keep the service secure and prevent abuse.
        </li>
        <li>
          <strong>Consent</strong> — for any optional analytics/marketing cookies (see below), which you can withdraw
          at any time.
        </li>
      </ul>

      <h2>Cookies &amp; analytics</h2>
      <p>
        We use a small number of <strong>essential</strong> cookies/local storage to keep you signed in and remember
        your preferences — these are always on because the site can't work without them.
      </p>
      <p>
        We may also load <strong>optional</strong> analytics and advertising tools — such as Google Analytics and the
        Meta (Facebook) pixel — to understand traffic and measure ad campaigns. These load <strong>only</strong> after
        you accept them in the cookie banner, and not at all if you decline. You can change your choice any time by
        clearing the site's cookies, which brings the banner back.
      </p>

      <h2>Third parties we share with</h2>
      <ul>
        <li>
          <strong>Stripe</strong> — payments, payouts and fraud prevention (
          <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer noopener">
            stripe.com/privacy
          </a>
          ).
        </li>
        <li>
          <strong>Supabase</strong> — database, authentication and file storage.
        </li>
        <li>
          <strong>Resend</strong> — sending transactional email (purchase confirmations, receipts).
        </li>
        <li>
          <strong>Anthropic</strong> — optional AI-assisted copywriting, only when you use that feature.
        </li>
        <li>Google / Meta — only if you accept optional analytics/advertising cookies, as described above.</li>
      </ul>
      <p>Each processes only what's needed for its function. We don't sell your data to anyone.</p>

      <h2>International transfers</h2>
      <p>
        Some of these providers process data outside the European Economic Area (for example in the United States).
        Where they do, transfers rely on appropriate safeguards such as the providers' Standard Contractual Clauses.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account data while your account is open. Transaction records are kept for as long as the law
        requires (for tax and accounting). When you ask us to delete your account we remove your personal data, except
        records we're legally required to retain.
      </p>

      <h2>Your rights</h2>
      <p>
        If you're in the EU/EEA (or a similar regime), you have the right to access, correct, delete, restrict, object
        to, or port your personal data, and to withdraw consent for optional cookies. To exercise any of these, email{" "}
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>. You also have the right to complain to your local data
        protection authority.
      </p>

      <h2>A note for sellers</h2>
      <p>
        When you sell on {BRAND_NAME}, you also handle your buyers' data (their email and what they bought). You are
        responsible for using it lawfully — for example, only emailing buyers about their purchase unless they've
        agreed to marketing. See our <Link to="/terms">Terms</Link> for more.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
