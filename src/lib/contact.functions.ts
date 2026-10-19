import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isRateLimited } from "@/lib/rate-limit";
import { CONTACT_MESSAGE_MAX, CONTACT_MESSAGE_MIN } from "@/lib/contact-message";
import { sendContactEmail } from "@/lib/email.server";

// Whoever is sending this, as well as we can tell behind Railway's proxy. Only
// ever used as a rate-limit key.
function senderKey(): string {
  try {
    const { headers } = getRequest();
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

export type ContactResult = { ok: true } | { ok: false; reason: "rate" | "send" };

// The public contact form. Unlike the purchase-access form next door, this one
// reports failure honestly: a page that says "message sent" when Resend
// rejected it costs us the conversation and the person never knows.
export const sendContactMessage = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        message: z.string().trim().min(CONTACT_MESSAGE_MIN).max(CONTACT_MESSAGE_MAX),
        // Honeypot. It's hidden from people, so anything in it came from a bot
        // filling every input it found.
        website: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ContactResult> => {
    // Bots are told the same thing as everyone else — a visible rejection just
    // teaches the next attempt what to avoid.
    if (data.website) return { ok: true };

    // Per address and per sender: one stops a single person hammering send,
    // the other stops one machine working through a list of addresses.
    if (isRateLimited(`contact:${data.email}`, 3, 15 * 60 * 1000)) return { ok: false, reason: "rate" };
    if (isRateLimited(`contact-ip:${senderKey()}`, 10, 60 * 60 * 1000)) return { ok: false, reason: "rate" };

    const sent = await sendContactEmail({ fromEmail: data.email, message: data.message });
    return sent ? { ok: true } : { ok: false, reason: "send" };
  });
