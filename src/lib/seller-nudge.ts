import { BRAND_NAME } from "@/lib/site";

// One-time reminder emails to sellers who stopped part-way. Pure decisions and
// content here, kept apart from the database and the Resend call so they're
// directly testable — the same split as sale-email.ts.
//
// A look at the first 70 sign-ups found the same two gaps over and over:
// Stripe started and never finished (17 of 17), and products that went live
// but were never opened by anyone. Each seller gets each reminder at most once.

export type NudgeKind = "stripe" | "share";

// "finish": Stripe started, not done. "connect": a paid product is live but
// Stripe was never started, so buyers can't see it. "share": a product buyers
// can open has had no visits.
export type NudgeVariant = "finish" | "connect" | "share";

export type NudgeProduct = {
  name: string;
  // Set once the product is published (it has its own page).
  slug: string | null;
  free: boolean;
  hasFile: boolean;
  createdAt: Date;
};

export type SellerState = {
  signedUpAt: Date;
  stripe: "none" | "started" | "ready";
  deactivated: boolean;
  products: NudgeProduct[];
  // Any visit at all to any of their product pages.
  hasViews: boolean;
  // Reminders already sent, and when.
  sent: Partial<Record<NudgeKind, Date>>;
};

const DAY = 24 * 60 * 60 * 1000;
// Give people a day to finish on their own before reminding them.
export const NUDGE_WAIT_DAYS = 1;
// Never two reminders within this many days of each other.
export const NUDGE_GAP_DAYS = 2;

/** The reminder due for this seller right now, if any. Stripe comes first: it blocks every sale. */
export function nextNudge(
  s: SellerState,
  now: Date,
): { kind: NudgeKind; variant: NudgeVariant; product: NudgeProduct | null } | null {
  if (s.deactivated) return null;
  const waited = (d: Date) => now.getTime() - d.getTime() >= NUDGE_WAIT_DAYS * DAY;
  if (!waited(s.signedUpAt)) return null;
  const lastSent = Math.max(0, ...Object.values(s.sent).map((d) => d.getTime()));
  if (lastSent && now.getTime() - lastSent < NUDGE_GAP_DAYS * DAY) return null;

  const live = s.products.filter((p) => p.slug && p.hasFile && waited(p.createdAt));

  if (!s.sent.stripe) {
    if (s.stripe === "started") return { kind: "stripe", variant: "finish", product: live.find((p) => !p.free) ?? null };
    const hiddenPaid = live.find((p) => !p.free);
    if (s.stripe === "none" && hiddenPaid) return { kind: "stripe", variant: "connect", product: hiddenPaid };
  }

  if (!s.sent.share && !s.hasViews) {
    // Only a product buyers can actually open: a paid one stays hidden until
    // Stripe is ready, and sharing that link would show them nothing.
    const open = live.find((p) => p.free || s.stripe === "ready");
    if (open) return { kind: "share", variant: "share", product: open };
  }
  return null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildNudgeEmail(params: {
  variant: NudgeVariant;
  firstName: string | null;
  productName: string | null;
  productUrl: string | null;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const hi = params.firstName ? `Hi ${params.firstName},` : "Hi,";
  const product = params.productName ?? "your product";
  const footer = `You're getting this one-time reminder because you created a ${BRAND_NAME} account. We won't send it again.`;

  let subject: string;
  let heading: string;
  let paragraphs: string[];
  let list: string[] = [];
  let button: { label: string; url: string };
  let closing: string;

  if (params.variant === "finish") {
    subject = "One step left before you can get paid";
    heading = "You're one step from getting paid";
    paragraphs = [
      `You started connecting Stripe on ${BRAND_NAME} but didn't finish. ` +
        (params.productName
          ? `Until it's done, nobody can buy ${params.productName} — it stays hidden from buyers.`
          : "Until it's done, you can't take payments."),
      "It takes about 5 minutes. Stripe asks for photo ID and your bank details — that's the law for card payments, not us. Your money goes straight to your own account.",
    ];
    button = { label: "Finish connecting Stripe", url: params.dashboardUrl };
    closing = "Stuck on something Stripe asked for? Reply to this email and we'll help.";
  } else if (params.variant === "connect") {
    subject = `${product} can't be bought yet`;
    heading = "Your product is ready — but hidden from buyers";
    paragraphs = [
      `${product} is on ${BRAND_NAME}, but buyers can't see it or pay for it until you connect Stripe. That's where your money is paid out, straight to your own account.`,
      "It takes about 5 minutes: photo ID and your bank details.",
    ];
    button = { label: "Connect Stripe", url: params.dashboardUrl };
    closing = "Questions? Just reply to this email.";
  } else {
    subject = `${product} is live — now let people see it`;
    heading = "Your product is live. Nobody has seen it yet.";
    paragraphs = [
      `${product} is ready to sell, but no one has opened it so far. Sales come from people seeing your link. Three easy places to put it:`,
    ];
    list = [
      "Your Instagram or TikTok bio",
      "A post or story showing what's inside",
      "A message to people who've asked you about it",
    ];
    button = { label: "Open your product page", url: params.productUrl ?? params.dashboardUrl };
    closing = "Want a second pair of eyes on your product page? Reply and we'll take a look.";
  }

  const linkLine = params.variant === "share" && params.productUrl ? params.productUrl : null;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a;">
      <p style="margin:0 0 12px;">${esc(hi)}</p>
      <h1 style="font-size:22px;margin:0 0 12px;">${esc(heading)}</h1>
      ${paragraphs.map((p) => `<p style="color:#334155;line-height:1.5;margin:0 0 12px;">${esc(p)}</p>`).join("")}
      ${list.length ? `<ul style="color:#334155;line-height:1.6;margin:0 0 12px;padding-left:20px;">${list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      ${linkLine ? `<p style="margin:0 0 4px;color:#64748b;font-size:13px;">Your link:</p><p style="margin:0 0 12px;font-family:monospace;font-size:14px;word-break:break-all;"><a href="${esc(linkLine)}" style="color:#1a7a7a;">${esc(linkLine)}</a></p>` : ""}
      <a href="${esc(button.url)}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#1a7a7a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">${esc(button.label)}</a>
      <p style="margin-top:24px;color:#475569;">${esc(closing)}</p>
      <p style="margin-top:24px;color:#94a3b8;font-size:12px;">${esc(footer)}</p>
    </div>
  `.trim();

  const text = [
    hi,
    "",
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(list.length ? [...list.map((l) => `- ${l}`), ""] : []),
    ...(linkLine ? [`Your link: ${linkLine}`, ""] : []),
    `${button.label}: ${button.url}`,
    "",
    closing,
    "",
    footer,
  ].join("\n");

  return { subject, html, text };
}

/** First word of a display name, for the greeting; nothing if it doesn't look like a name. */
export function firstNameOf(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0] ?? "";
  return first && first.length <= 30 && !first.includes("@") ? first : null;
}
