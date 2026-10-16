import type { Currency } from "@/lib/currency";
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
// The address emails come from, e.g. hello@halvo.io once that domain is verified
// in Resend. Resend's sandbox sender only delivers to the account owner's inbox.
const SANDBOX_SENDER = "onboarding@resend.dev";

function senderAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS?.trim() || SANDBOX_SENDER;
}

/**
 * True when we're falling back to Resend's sandbox sender, which delivers ONLY
 * to the Resend account owner's own address and rejects everyone else.
 *
 * This is the most deceptive state the email config can be in, and it's the
 * one you land in by doing the obvious thing: setting RESEND_API_KEY and
 * nothing else. Before the key is set, nothing sends and the log says so
 * plainly. After it's set but with no EMAIL_FROM_ADDRESS, your own test
 * emails arrive — so it looks configured — while every real buyer is
 * silently rejected.
 */
function usingSandboxSender(): boolean {
  return senderAddress() === SANDBOX_SENDER;
}

// Warn once per process rather than per email: a busy launch day would
// otherwise bury the message under thousands of copies of itself.
let sandboxWarned = false;

function warnIfSandboxSender(recipient: string): void {
  if (!usingSandboxSender() || sandboxWarned) return;
  sandboxWarned = true;
  console.error(
    `EMAIL_FROM_ADDRESS is not set, so mail is being sent from Resend's ` +
      `sandbox sender (${SANDBOX_SENDER}). Resend delivers that ONLY to the ` +
      `Resend account owner's own address and rejects every other recipient — ` +
      `so buyers like ${recipient} will NOT receive anything, and the purchase ` +
      `will still look successful. Verify a domain in Resend and set ` +
      `EMAIL_FROM_ADDRESS (e.g. hello@halvo.io) before taking real orders.`,
  );
}

async function sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Shared by purchase confirmations, sale notifications, access recovery and
    // billing mail — so name the actual message rather than assuming which.
    console.error(
      `RESEND_API_KEY not set — NOT sending "${params.subject}" to ${params.to}. ` +
        `No email will be delivered by this install until it is configured.`,
    );
    return;
  }

  warnIfSandboxSender(params.to);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND_NAME} <${senderAddress()}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      // Name the message and the recipient: this is shared by purchase
      // confirmations, sale notifications, access recovery and billing mail,
      // and "send failed" alone doesn't say whose download never arrived.
      console.error(
        `Resend rejected "${params.subject}" to ${params.to}: ${res.status} ${await res.text()}` +
          (usingSandboxSender()
            ? ` — almost certainly because EMAIL_FROM_ADDRESS is unset and the sandbox sender only reaches the Resend account owner.`
            : ""),
      );
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
  currency?: Currency;
}): Promise<void> {
  if (params.buyerEmail.endsWith("@buyer.reconciled")) return; // placeholder from the webhook fallback path, not a real address

  const { subject, html, text } = buildPurchaseEmail({
    productName: params.productName,
    downloadPageUrl: `${BASE_URL}/success?id=${params.transactionId}`,
    amountCents: params.amountCents,
    currency: params.currency,
  });
  await sendEmail({ to: params.buyerEmail, subject, html, text });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Sent with a new membership or payment plan, alongside the normal purchase
// email: the buyer has no account, so this link is how they manage billing.
export async function sendBillingLinkEmail(params: {
  buyerEmail: string;
  productName: string;
  planLabel: string;
  manageUrl: string;
}): Promise<void> {
  if (params.buyerEmail.endsWith("@buyer.reconciled")) return;
  const name = escapeHtml(params.productName);
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a1c1a">
    <p>You're subscribed to <strong>${name}</strong> — ${escapeHtml(params.planLabel)}.</p>
    <p>Keep this email. Use the link below any time to update your card, see your payments${
      params.planLabel.includes("membership") ? " or cancel" : ""
    }:</p>
    <p><a href="${params.manageUrl}" style="color:#0d7a70;font-weight:600">Manage your billing</a></p>
  </div>`;
  const text = `You're subscribed to ${params.productName} — ${params.planLabel}.\n\nManage your billing (update card, see payments): ${params.manageUrl}`;
  await sendEmail({ to: params.buyerEmail, subject: `Manage your ${params.productName} billing`, html, text });
}

export async function sendPaymentFailedEmail(params: {
  buyerEmail: string;
  productName: string;
  manageUrl: string;
  graceEndsAt: string;
}): Promise<void> {
  if (params.buyerEmail.endsWith("@buyer.reconciled")) return;
  const date = new Date(params.graceEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const name = escapeHtml(params.productName);
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a1c1a">
    <p>We couldn't take your latest payment for <strong>${name}</strong>.</p>
    <p>You still have full access until <strong>${date}</strong>. Update your card before then to keep it — we'll retry automatically:</p>
    <p><a href="${params.manageUrl}" style="color:#0d7a70;font-weight:600">Update your payment method</a></p>
  </div>`;
  const text = `We couldn't take your latest payment for ${params.productName}. You keep access until ${date}. Update your card: ${params.manageUrl}`;
  await sendEmail({ to: params.buyerEmail, subject: `Payment failed for ${params.productName}`, html, text });
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

  // A broadcast on the sandbox sender reaches nobody but the Resend account
  // owner, and would otherwise report a cheerful "sent to N people".
  warnIfSandboxSender(params.messages[0]?.to ?? "your subscribers");

  // Display names can't carry quotes or angle brackets without breaking the header.
  const safeName = params.fromName.replace(/["<>\r\n]/g, "").trim() || BRAND_NAME;
  const from = `${safeName} via ${BRAND_NAME} <${senderAddress()}>`;

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
  currency?: Currency;
  isFirstSale: boolean;
}): Promise<void> {
  const { subject, html, text } = buildSaleNotificationEmail({
    productName: params.productName,
    amountCents: params.amountCents,
    currency: params.currency,
    isFirstSale: params.isFirstSale,
    dashboardUrl: `${BASE_URL}/dashboard`,
  });
  await sendEmail({ to: params.sellerEmail, subject, html, text });
}
