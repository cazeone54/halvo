import { BRAND_NAME } from "@/lib/site";
import { formatCents } from "@/lib/format";

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

  const hasReceipt = params.amountCents !== undefined;
  const amountLabel = params.amountCents === 0 ? "Free" : formatCents(params.amountCents ?? 0);
  const dateLabel = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const receiptHtml = hasReceipt
    ? `<p style="margin-top:4px;color:#94a3b8;font-size:13px;">${amountLabel} &middot; ${dateLabel}</p>`
    : "";
  const receiptText = hasReceipt ? `\n${amountLabel} · ${dateLabel}` : "";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;">Thanks for your purchase!</h1>
      <p style="color:#475569;">${params.productName}</p>
      ${receiptHtml}
      <a href="${params.downloadPageUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Get your download</a>
      <p style="margin-top:24px;color:#94a3b8;font-size:13px;">Sent by ${BRAND_NAME}. Keep this email in case you need to redownload later.</p>
    </div>
  `.trim();
  const text = `Thanks for your purchase!\n\n${params.productName}${receiptText}\n\nDownload it here: ${params.downloadPageUrl}\n\nSent by ${BRAND_NAME}.`;

  return { subject, html, text };
}
