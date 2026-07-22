import { createFileRoute } from "@tanstack/react-router";
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
      <p>
        Account details (email, display name), the products and files you upload, and transaction records needed to
        deliver purchases and process payouts.
      </p>

      <h2>How we use it</h2>
      <p>
        To operate {BRAND_NAME} — authenticating you, processing payments via Stripe, delivering downloads, and
        showing you your own sales/analytics data. We don't sell your data.
      </p>

      <h2>Third parties</h2>
      <p>
        Payments are handled by Stripe, hosting/database by Supabase, and (optionally) AI-assisted copywriting by
        Anthropic. Each processes only what's needed for their function.
      </p>

      <h2>Your data</h2>
      <p>You can request deletion of your account and associated data by contacting {BRAND_EMAIL}.</p>
    </LegalLayout>
  );
}
