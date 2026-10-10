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
  amountCents?: number;
}): Promise<void> {
  if (params.buyerEmail.endsWith("@buyer.reconciled")) return; // placeholder from the webhook fallback path, not a real address

  const { subject, html, text } = buildPurchaseEmail({
    productName: params.productName,
    downloadPageUrl: `${BASE_URL}/success?id=${params.transactionId}`,
    amountCents: params.amountCents,
  });
  await sendEmail({ to: params.buyerEmail, subject, html, text });
}

// Re-sends a buyer the links to everything they've bought, when they've lost the
// original confirmation email. Only ever sent to the address that actually made
// the purchases (that's the proof of ownership), and only when there's at least
// one — see requestPurchaseAccess, which never reveals whether an email matched.
export async function sendPurchaseAccessEmail(params: {
  email: string;
  purchases: Array<{ productName: string; transactionId: string }>;
}): Promise<void> {
  if (params.purchases.length === 0) return;

  const rows = params.purchases
    .map((p) => {
      const url = `${BASE_URL}/success?id=${p.transactionId}`;
      const name = p.productName.replace(/</g, "&lt;");
      return `<li style="margin-bottom:10px"><a href="${url}" style="color:#0d7a70;font-weight:600">${name}</a></li>`;
    })
    .join("");

  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a1c1a">
    <p>Here are your ${BRAND_NAME} downloads. Click a product to open its download page again:</p>
    <ul style="padding-left:18px">${rows}</ul>
    <p style="color:#4e6c67;font-size:13px">If you didn't request this, you can ignore this email — nothing changed.</p>
  </div>`;

  const text = `Your ${BRAND_NAME} downloads:\n\n${params.purchases
    .map((p) => `- ${p.productName}: ${BASE_URL}/success?id=${p.transactionId}`)
    .join("\n")}\n\nIf you didn't request this, you can ignore this email.`;

  await sendEmail({ to: params.email, subject: `Your ${BRAND_NAME} downloads`, html, text });
}

// Seller -> buyer broadcast, sent through Resend's batch endpoint (up to 100
// per request, each message with its own unsubscribe link). Carries the
// List-Unsubscribe headers Gmail and Yahoo require for bulk mail, including
// one-click (RFC 8058): the mail client POSTs to oneClickUrl (an API route),
// while the link in the body opens a confirmation page for people. Replies go
// to the seller, not to the platform. Returns how many messages Resend accepted.
export async function sendBroadcastEmails(params: {
  fromName: string;
  replyTo: string | null;
  messages: Array<{ to: string; subject: string; html: string; text: string; oneClickUrl: string }>;
}): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set — broadcast not sent");
    return 0;
  }

  // Display names can't carry quotes or angle brackets without breaking the header.
  const safeName = params.fromName.replace(/["<>\r\n]/g, "").trim() || BRAND_NAME;
  const from = `${safeName} via ${BRAND_NAME} <onboarding@resend.dev>`;

  let accepted = 0;
  for (let i = 0; i < params.messages.length; i += 100) {
    const chunk = params.messages.slice(i, i + 100).map((m) => ({
      from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      headers: {
        "List-Unsubscribe": `<${m.oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: unknown[] };
        accepted += Array.isArray(body.data) ? body.data.length : chunk.length;
      } else {
        console.error("Resend batch send failed:", res.status, await res.text());
      }
    } catch (error) {
      console.error("Resend batch send threw:", error);
    }
  }
  return accepted;
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
