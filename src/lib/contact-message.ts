import { BRAND_NAME } from "@/lib/site";

// The email the contact form turns into. Pure, so the wording and the escaping
// can be tested without sending anything.

export const CONTACT_MESSAGE_MAX = 4000;
export const CONTACT_MESSAGE_MIN = 10;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The inbox shows a list of subjects, so the subject has to say what the
// message is about. The first line of what they wrote does that better than a
// fixed "New contact form submission" on every one.
export function contactSubject(message: string): string {
  const firstLine = message.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const summary = firstLine.length > 72 ? `${firstLine.slice(0, 71).trimEnd()}…` : firstLine;
  return summary ? `${BRAND_NAME} contact: ${summary}` : `${BRAND_NAME} contact form`;
}

export function buildContactEmail(params: { fromEmail: string; message: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const message = params.message.trim();
  const paragraphs = message
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const from = escapeHtml(params.fromEmail);
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a1c1a">
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #e3eceb;margin:20px 0">
    <p style="color:#4e6c67;font-size:13px;margin:0">
      From <a href="mailto:${from}" style="color:#0d7a70">${from}</a> via the ${BRAND_NAME} contact form.<br>
      Reply to this email and your answer goes straight to them.
    </p>
  </div>`;

  const text = `${message}\n\n---\nFrom ${params.fromEmail} via the ${BRAND_NAME} contact form.\nReply to this email and your answer goes straight to them.`;

  return { subject: contactSubject(message), html, text };
}
