// Follow-up emails after a free download. Email 1 is the download email that
// already goes out on claim; this adds email 2 (two days later, something
// useful) and email 3 (five days later, one paid product). Pure: the timing,
// the wording and the HTML are all decided here and tested; the sender only
// fetches rows and hands them over.

export const STEP2_AFTER_DAYS = 2;
export const STEP3_AFTER_DAYS = 5;
// A download older than this never starts getting emails — if sending was off
// for a while, nobody hears from a seller weeks after they forgot about them.
export const SEQUENCE_WINDOW_DAYS = 14;
// Two follow-ups never land on the same day, even after an outage.
const MIN_GAP_MS = 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const SUBJECT_MAX = 150;
export const BODY_MAX = 5000;

// Complete and sendable as they stand: a seller who switches the sequence on
// without editing anything must never send "[write your tip here]".
export const SEQUENCE_DEFAULTS = {
  step2Subject: "Getting the most from {product}",
  step2Body:
    "Hi,\n\nThanks for downloading {product}. The people who get the most out of it set aside twenty minutes this week to use it, rather than saving it for later.\n\nIf you get stuck or have a question, just reply to this email. I read every one.\n\n{seller}",
  step3Subject: "If {product} helped, here's the next step",
  step3Body:
    "Hi,\n\nIf {product} was useful, you'll like {offer}. It picks up where the free one stops.\n\n{seller}",
};

// {product} = the free product they downloaded, {offer} = the paid product in
// email 3, {seller} = the seller's name. Unknown braces are left as typed.
export function fillPlaceholders(text: string, values: { product: string; offer?: string | null; seller: string }): string {
  return text
    .replace(/\{product\}/g, values.product)
    .replace(/\{offer\}/g, values.offer ?? "")
    .replace(/\{seller\}/g, values.seller);
}

/**
 * Which follow-up, if any, is due for one free download right now.
 * At most one step per call, so a sender that was down catches up one email
 * per run instead of sending both at once.
 */
export function nextDueStep(args: {
  claimedAt: Date;
  now: Date;
  sent: Partial<Record<2 | 3, Date>>;
  hasOffer: boolean;
}): 2 | 3 | null {
  const age = args.now.getTime() - args.claimedAt.getTime();
  if (age < 0 || age > SEQUENCE_WINDOW_DAYS * DAY) return null;
  if (!args.sent[2]) return age >= STEP2_AFTER_DAYS * DAY ? 2 : null;
  if (args.sent[3] || !args.hasOffer) return null;
  if (age < STEP3_AFTER_DAYS * DAY) return null;
  return args.now.getTime() - args.sent[2].getTime() >= MIN_GAP_MS ? 3 : null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * The email itself. The seller's words are escaped, never rendered as markup;
 * blank lines become paragraphs. Email 3 gets a button to the product (with
 * the discount already applied when there is a valid code), and every email
 * says why it arrived and has a one-click way out.
 */
export function buildSequenceEmail(params: {
  sellerName: string;
  freeProductName: string;
  subject: string;
  body: string;
  unsubscribeUrl: string;
  cta?: { label: string; url: string; codeLine?: string | null } | null;
}): { subject: string; html: string; text: string } {
  const seller = params.sellerName.trim() || "the creator";
  const paragraphs = params.body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const cta = params.cta
    ? `<p style="margin:20px 0 6px"><a href="${escapeHtml(params.cta.url)}" style="display:inline-block;background:#0d8f7c;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:8px">${escapeHtml(params.cta.label)}</a></p>${
        params.cta.codeLine ? `<p style="margin:0 0 14px;color:#4e6c67;font-size:14px">${escapeHtml(params.cta.codeLine)}</p>` : ""
      }`
    : "";
  const footer = `You're getting this because you downloaded ${params.freeProductName} from ${seller}.`;
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a1c1a;max-width:560px">
    ${paragraphs}${cta}
    <hr style="border:none;border-top:1px solid #dfe8e6;margin:24px 0 12px">
    <p style="color:#4e6c67;font-size:12px;margin:0">${escapeHtml(footer)} <a href="${escapeHtml(
      params.unsubscribeUrl,
    )}" style="color:#4e6c67">Unsubscribe</a></p>
  </div>`;
  const ctaText = params.cta ? `\n\n${params.cta.label}: ${params.cta.url}${params.cta.codeLine ? `\n${params.cta.codeLine}` : ""}` : "";
  const text = `${params.body.trim()}${ctaText}\n\n--\n${footer}\nUnsubscribe: ${params.unsubscribeUrl}`;
  return { subject: params.subject.trim(), html, text };
}

// "Code WELCOME10 takes 10% off until 31 Oct." — only ever describes a real
// coupon: its real discount, and its real end date if it has one.
export function describeCode(coupon: {
  code: string;
  percentOff: number | null;
  amountOffLabel: string | null;
  expiresAt: string | null;
}): string {
  const off = coupon.percentOff ? `${coupon.percentOff}% off` : coupon.amountOffLabel ? `${coupon.amountOffLabel} off` : "a discount";
  const until = coupon.expiresAt
    ? ` until ${new Date(coupon.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    : "";
  return `Code ${coupon.code} takes ${off}${until}, already applied through this link.`;
}
