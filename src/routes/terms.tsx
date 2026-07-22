import { createFileRoute } from "@tanstack/react-router";
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
        {BRAND_NAME} lets creators sell digital products directly to buyers. By creating an account you agree to use
        the platform lawfully and not to sell content you don't have the rights to distribute.
      </p>

      <h2>2. Payments</h2>
      <p>
        Payments are processed by Stripe. Sellers connect their own Stripe account and are paid directly; {BRAND_NAME}
        collects a platform fee on Free-tier sales as described on the Pricing page.
      </p>

      <h2>3. Content</h2>
      <p>
        You retain ownership of everything you upload. You're responsible for having the rights to sell it, and for
        the accuracy of your product descriptions.
      </p>

      <h2>4. Termination</h2>
      <p>We may suspend accounts that violate these terms or applicable law.</p>

      <h2>5. Contact</h2>
      <p>Questions about these terms: {BRAND_EMAIL}.</p>
    </LegalLayout>
  );
}
