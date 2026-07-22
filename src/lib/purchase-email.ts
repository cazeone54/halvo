import { BRAND_NAME } from "@/lib/site";

// Pure content generation, kept separate from the actual Resend API call so
// it's directly testable. Deliberately links back to our own /success page
// rather than embedding an actual signed download URL — signed URLs expire,
// but /success always re-verifies the purchase and re-signs a fresh
// download link on every visit.
export function buildPurchaseEmail(params: { productName: string; downloadPageUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your download: ${params.productName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;">Thanks for your purchase!</h1>
      <p style="color:#475569;">${params.productName}</p>
      <a href="${params.downloadPageUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Get your download</a>
      <p style="margin-top:24px;color:#94a3b8;font-size:13px;">Sent by ${BRAND_NAME}. Keep this email in case you need to redownload later.</p>
    </div>
  `.trim();
  const text = `Thanks for your purchase!\n\n${params.productName}\n\nDownload it here: ${params.downloadPageUrl}\n\nSent by ${BRAND_NAME}.`;

  return { subject, html, text };
}
