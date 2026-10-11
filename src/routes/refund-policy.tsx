import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: `Refund Policy — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Digital products on ${BRAND_NAME} are delivered instantly and sales are final, except when a file is faulty, missing or not as described.`,
      },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/refund-policy` }],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy">
      <h2>Digital products are final sales</h2>
      <p>
        Everything sold on {BRAND_NAME} is digital and delivered the moment payment completes. Before paying, buyers
        confirm that they want immediate access and that they lose the 14-day right of withdrawal once the product is
        delivered. The receipt email confirms this. Because of that, sales are final and there are no refunds for
        changing your mind.
      </p>

      <h2>When you will get a refund</h2>
      <ul>
        <li>The file is faulty or won't open, and the seller can't fix it.</li>
        <li>The file is missing, or what you received is clearly not what the product page described.</li>
        <li>You were charged twice for the same purchase.</li>
      </ul>
      <p>
        Contact the seller using the details on the product page. Sellers issue refunds from their dashboard; the money
        goes back to your card through Stripe and the download is switched off. Nothing here limits any rights you have
        under the consumer law of your country.
      </p>

      <h2>Memberships and payment plans</h2>
      <p>
        You can cancel a membership at any time from the billing link in your email. You keep access until the end of
        the period you've paid for, and you aren't charged again. Payments already made are not refunded. A payment plan
        can't be cancelled part-way in exchange for a refund, because you receive the whole product on the first payment.
      </p>

      <h2>Sellers can be more generous</h2>
      <p>
        A seller may offer a refund window on their own products. If they do, it's shown on the product page and it
        applies on top of this policy.
      </p>

      <h2>Chargebacks</h2>
      <p>
        If you have a problem, please contact the seller first. Opening a chargeback instead pauses access to the
        product while the bank reviews it.
      </p>
    </LegalLayout>
  );
}
