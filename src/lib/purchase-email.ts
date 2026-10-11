import { BRAND_NAME } from "@/lib/site";
import { formatCents } from "@/lib/format";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// For paid digital content, EU consumer law ends the 14-day right of
// withdrawal once delivery starts only if the buyer agreed to immediate access
// and acknowledged losing that right at checkout, AND the trader confirms it on
// a durable medium. This receipt is that confirmation, so it must stay in sync
// with the checkout checkbox wording (FINAL_SALE_ACK in checkout-widget.tsx).
export const FINAL_SALE_CONFIRMATION =
  "At checkout you asked for immediate access to this digital product and acknowledged that you lose your 14-day right of withdrawal once it is delivered. Sales are therefore final. If the file is faulty, missing or not as described, contact the seller using the details on the product page and they will fix it or refund you.";

// Pure content generation, kept separate from the actual Resend API call so
// it's directly testable. Deliberately links back to our own /success page
// rather than embedding an actual signed download URL — signed URLs expire,
// but /success always re-verifies the purchase and re-signs a fresh
// download link on every visit.
export function buildPurchaseEmail(params: {
  productName: string;
  downloadPageUrl: string;
  // Optional so callers that don't have it still work; when present it turns the
  // email into a simple receipt (amount + date) the buyer can keep for records.
  amountCents?: number;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your download: ${params.productName}`;
  const name = escapeHtml(params.productName);

  const hasReceipt = params.amountCents !== undefined;
  const isPaid = (params.amountCents ?? 0) > 0;
  const amountLabel = params.amountCents === 0 ? "Free" : formatCents(params.amountCents ?? 0);
  const dateLabel = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const receiptHtml = hasReceipt
    ? `<p style="margin-top:4px;color:#94a3b8;font-size:13px;">${amountLabel} &middot; ${dateLabel}</p>`
    : "";
  const receiptText = hasReceipt ? `\n${amountLabel} · ${dateLabel}` : "";
  const finalSaleHtml = isPaid
    ? `<p style="margin-top:20px;color:#64748b;font-size:12px;line-height:1.5;">${FINAL_SALE_CONFIRMATION}</p>`
    : "";
  const finalSaleText = isPaid ? `\n\n${FINAL_SALE_CONFIRMATION}` : "";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;">Thanks for your purchase!</h1>
      <p style="color:#475569;">${name}</p>
      ${receiptHtml}
      <a href="${params.downloadPageUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Get your download</a>
      ${finalSaleHtml}
      <p style="margin-top:24px;color:#94a3b8;font-size:13px;">Sent by ${BRAND_NAME}. Keep this email in case you need to redownload later.</p>
    </div>
  `.trim();
  const text = `Thanks for your purchase!\n\n${params.productName}${receiptText}\n\nDownload it here: ${params.downloadPageUrl}${finalSaleText}\n\nSent by ${BRAND_NAME}.`;

  return { subject, html, text };
}
