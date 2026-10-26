import { describe, expect, it } from "vitest";
import { SEQUENCE_DEFAULTS, buildSequenceEmail, describeCode, fillPlaceholders, nextDueStep } from "./email-sequence";

const DAY = 24 * 60 * 60 * 1000;
const claimed = new Date("2026-10-01T10:00:00Z");
const at = (days: number) => new Date(claimed.getTime() + days * DAY);

describe("nextDueStep", () => {
  it("sends nothing in the first two days", () => {
    expect(nextDueStep({ claimedAt: claimed, now: at(1.9), sent: {}, hasOffer: true })).toBeNull();
  });

  it("sends email 2 after two days, then email 3 after five", () => {
    expect(nextDueStep({ claimedAt: claimed, now: at(2), sent: {}, hasOffer: true })).toBe(2);
    expect(nextDueStep({ claimedAt: claimed, now: at(4), sent: { 2: at(2) }, hasOffer: true })).toBeNull();
    expect(nextDueStep({ claimedAt: claimed, now: at(5), sent: { 2: at(2) }, hasOffer: true })).toBe(3);
    expect(nextDueStep({ claimedAt: claimed, now: at(6), sent: { 2: at(2), 3: at(5) }, hasOffer: true })).toBeNull();
  });

  it("never sends two follow-ups on the same day after an outage", () => {
    // Sender was down until day 6: email 2 goes now, email 3 waits a day.
    expect(nextDueStep({ claimedAt: claimed, now: at(6), sent: {}, hasOffer: true })).toBe(2);
    expect(nextDueStep({ claimedAt: claimed, now: at(6.5), sent: { 2: at(6) }, hasOffer: true })).toBeNull();
    expect(nextDueStep({ claimedAt: claimed, now: at(7), sent: { 2: at(6) }, hasOffer: true })).toBe(3);
  });

  it("skips email 3 when there's no product to offer", () => {
    expect(nextDueStep({ claimedAt: claimed, now: at(6), sent: { 2: at(2) }, hasOffer: false })).toBeNull();
  });

  it("stops for downloads older than the window", () => {
    expect(nextDueStep({ claimedAt: claimed, now: at(15), sent: {}, hasOffer: true })).toBeNull();
    expect(nextDueStep({ claimedAt: claimed, now: at(15), sent: { 2: at(2) }, hasOffer: true })).toBeNull();
  });
});

describe("fillPlaceholders", () => {
  it("fills the three names and leaves other braces alone", () => {
    expect(fillPlaceholders("{product} → {offer}, from {seller} {other}", { product: "Free Guide", offer: "Course", seller: "Maria" })).toBe(
      "Free Guide → Course, from Maria {other}",
    );
  });

  it("the defaults have nothing left for the seller to fill in", () => {
    for (const text of Object.values(SEQUENCE_DEFAULTS)) {
      const filled = fillPlaceholders(text, { product: "P", offer: "O", seller: "S" });
      expect(filled).not.toMatch(/[{}[\]]/);
    }
  });
});

describe("buildSequenceEmail", () => {
  it("escapes the seller's words, says why it arrived, and lets people leave", () => {
    const email = buildSequenceEmail({
      sellerName: "Maria",
      freeProductName: "Morning Routine",
      subject: " Hello ",
      body: "<script>alert(1)</script>\n\nSecond paragraph",
      unsubscribeUrl: "https://halvo.io/unsubscribe?t=abc",
    });
    expect(email.subject).toBe("Hello");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("you downloaded Morning Routine from Maria");
    expect(email.html).toContain("https://halvo.io/unsubscribe?t=abc");
    expect(email.text).toContain("Unsubscribe: https://halvo.io/unsubscribe?t=abc");
  });

  it("adds the product button and the code line for email 3", () => {
    const email = buildSequenceEmail({
      sellerName: "Maria",
      freeProductName: "Free",
      subject: "Next",
      body: "Body",
      unsubscribeUrl: "https://halvo.io/u",
      cta: { label: "Get the Course", url: "https://halvo.io/p/course?coupon=WELCOME10", codeLine: "Code WELCOME10 takes 10% off." },
    });
    expect(email.html).toContain('href="https://halvo.io/p/course?coupon=WELCOME10"');
    expect(email.html).toContain("Get the Course");
    expect(email.text).toContain("Get the Course: https://halvo.io/p/course?coupon=WELCOME10");
    expect(email.text).toContain("Code WELCOME10 takes 10% off.");
  });
});

describe("describeCode", () => {
  it("states the real discount and the real end date only", () => {
    expect(describeCode({ code: "WELCOME10", percentOff: 10, amountOffLabel: null, expiresAt: "2026-10-31T21:59:59Z" })).toBe(
      "Code WELCOME10 takes 10% off until 31 Oct, already applied through this link.",
    );
    expect(describeCode({ code: "FIVE", percentOff: null, amountOffLabel: "€5.00", expiresAt: null })).toBe(
      "Code FIVE takes €5.00 off, already applied through this link.",
    );
  });
});
