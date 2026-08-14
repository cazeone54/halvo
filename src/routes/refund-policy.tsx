import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: `Refund Policy — ${BRAND_NAME}` },
      {
        name: "description",
        content: `How refunds work on ${BRAND_NAME}: sellers set their own policy and refunds are issued through Stripe.`,
      },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/refund-policy` }],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy">
      <p>
        Refunds on {BRAND_NAME} are issued at the seller's discretion, directly from their dashboard. When a seller
        issues a refund, the buyer's payment is refunded through Stripe and download access is revoked.
      </p>
      <p>
        Individual sellers may set their own refund policy for their products — check the product page or contact the
        seller directly if you have questions about a specific purchase.
      </p>
    </LegalLayout>
  );
}
