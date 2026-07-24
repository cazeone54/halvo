import { BRAND_NAME } from "@/lib/site";
import { formatCents } from "@/lib/format";

// Pure content generation, kept separate from the Resend call so it's directly
// testable — same split as purchase-email.ts.
//
// This is the seller-facing half of a sale. Until now a sale produced a grey
// row in a dashboard the seller had to remember to open; nothing ever reached
// them. The notification is the moment that ties earning money to this
// product, and the first one gets its own treatment on purpose.
export function buildSaleNotificationEmail(params: {
  productName: string;
  amountCents: number;
  isFirstSale: boolean;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const amount = formatCents(params.amountCents);

  const subject = params.isFirstSale
    ? `Your first sale — ${params.productName}`
    : `You made a sale: ${params.productName} (${amount})`;

  const heading = params.isFirstSale ? "You made your first sale." : "You made a sale.";
  const closing = params.isFirstSale
    ? "That's the hard part done — the loop works. Share your link again and do it a second time."
    : "Keep sharing your link.";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="font-size:22px;margin:0 0 4px;">${heading}</h1>
      <p style="font-size:32px;font-weight:800;color:#1a7a7a;margin:8px 0 4px;">${amount}</p>
      <p style="color:#475569;margin:0;">${params.productName}</p>
      <a href="${params.dashboardUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View it in your dashboard</a>
      <p style="margin-top:24px;color:#94a3b8;font-size:13px;">${closing}</p>
      <p style="margin-top:16px;color:#94a3b8;font-size:12px;">Sent by ${BRAND_NAME}.</p>
    </div>
  `.trim();

  const text = `${heading}\n\n${amount} — ${params.productName}\n\nView it in your dashboard: ${params.dashboardUrl}\n\n${closing}\n\nSent by ${BRAND_NAME}.`;

  return { subject, html, text };
}
