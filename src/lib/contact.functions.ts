import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isRateLimited } from "@/lib/rate-limit";
import { senderKey } from "@/lib/sender-key.server";
import { CONTACT_MESSAGE_MAX, CONTACT_MESSAGE_MIN } from "@/lib/contact-message";
import { sendContactEmail } from "@/lib/email.server";

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
    const sender = senderKey();
    if (sender && isRateLimited(`contact-ip:${sender}`, 10, 60 * 60 * 1000)) return { ok: false, reason: "rate" };

    const sent = await sendContactEmail({ fromEmail: data.email, message: data.message });
    return sent ? { ok: true } : { ok: false, reason: "send" };
  });
