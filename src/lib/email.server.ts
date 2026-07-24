import { buildPurchaseEmail } from "@/lib/purchase-email";
import { buildSaleNotificationEmail } from "@/lib/sale-email";
import { BASE_URL, BRAND_NAME } from "@/lib/site";

// Direct fetch to Resend's REST API — no SDK dependency, same pattern as
// stripe.server.ts / anthropic.server.ts.
//
// Note: without a verified sending domain on the Resend account, Resend
// only allows sending to the account owner's own email address (anti-abuse
// restriction on new accounts) — real buyer emails will only work once a
// custom domain is verified there.
async function sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set — skipping purchase confirmation email");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND_NAME} <onboarding@resend.dev>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      console.error("Resend email send failed:", res.status, await res.text());
    }
  } catch (error) {
    // Never let an email provider hiccup break the actual purchase recording.
    console.error("Resend email send threw:", error);
  }
}

export async function sendPurchaseConfirmationEmail(params: {
  buyerEmail: string;
  productName: string;
  transactionId: string;
}): Promise<void> {
  if (params.buyerEmail.endsWith("@buyer.reconciled")) return; // placeholder from the webhook fallback path, not a real address

  const { subject, html, text } = buildPurchaseEmail({
    productName: params.productName,
    downloadPageUrl: `${BASE_URL}/success?id=${params.transactionId}`,
  });
  await sendEmail({ to: params.buyerEmail, subject, html, text });
}

// Tells the seller they earned money, at the moment they earned it. This is the
// retention half of a sale — the dashboard row only works if they happen to be
// looking at it.
export async function sendSaleNotificationEmail(params: {
  sellerEmail: string;
  productName: string;
  amountCents: number;
  isFirstSale: boolean;
}): Promise<void> {
  const { subject, html, text } = buildSaleNotificationEmail({
    productName: params.productName,
    amountCents: params.amountCents,
    isFirstSale: params.isFirstSale,
    dashboardUrl: `${BASE_URL}/dashboard`,
  });
  await sendEmail({ to: params.sellerEmail, subject, html, text });
}
