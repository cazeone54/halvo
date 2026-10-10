import { describe, expect, it } from "vitest";
import {
  BROADCAST_LIMITS,
  broadcastQuota,
  buildBroadcastEmail,
  selectBroadcastRecipients,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type BroadcastTxnRow,
} from "./broadcast";

const row = (buyer_email: string, overrides: Partial<BroadcastTxnRow> = {}): BroadcastTxnRow => ({
  buyer_email,
  status: "success",
  refunded_at: null,
  disputed_at: null,
  ...overrides,
});

describe("selectBroadcastRecipients", () => {
  it("dedupes case-insensitively and trims", () => {
    expect(selectBroadcastRecipients([row("A@x.com"), row(" a@x.com "), row("b@x.com")], [])).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });

  it("excludes failed, refunded and disputed purchases", () => {
    const rows = [
      row("failed@x.com", { status: "failed" }),
      row("refunded@x.com", { refunded_at: "2026-01-01T00:00:00Z" }),
      row("disputed@x.com", { disputed_at: "2026-01-01T00:00:00Z" }),
      row("ok@x.com"),
    ];
    expect(selectBroadcastRecipients(rows, [])).toEqual(["ok@x.com"]);
  });

  it("keeps a buyer who refunded one product but kept another", () => {
    const rows = [row("mixed@x.com", { refunded_at: "2026-01-01T00:00:00Z" }), row("mixed@x.com")];
    expect(selectBroadcastRecipients(rows, [])).toEqual(["mixed@x.com"]);
  });

  it("drops unsubscribed buyers regardless of case", () => {
    expect(selectBroadcastRecipients([row("Gone@x.com"), row("stay@x.com")], ["gone@X.com"])).toEqual(["stay@x.com"]);
  });

  it("drops webhook placeholder addresses and junk", () => {
    expect(selectBroadcastRecipients([row("pi_123@buyer.reconciled"), row("not-an-email"), row("")], [])).toEqual([]);
  });
});

describe("broadcastQuota", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

  it("allows the full quota with no history", () => {
    expect(broadcastQuota([], now)).toEqual({ remaining: BROADCAST_LIMITS.maxPerWindow, nextAvailableAt: null });
  });

  it("ignores sends older than the window", () => {
    expect(broadcastQuota([hoursAgo(30), hoursAgo(25)], now).remaining).toBe(2);
  });

  it("reports when the next slot frees up once the quota is used", () => {
    const res = broadcastQuota([hoursAgo(2), hoursAgo(10)], now);
    expect(res.remaining).toBe(0);
    // the older of the two (10h ago) ages out first, 14h from now
    expect(res.nextAvailableAt).toBe(new Date(now + 14 * 3600_000).toISOString());
  });

  it("is order-independent", () => {
    expect(broadcastQuota([hoursAgo(10), hoursAgo(2)], now)).toEqual(broadcastQuota([hoursAgo(2), hoursAgo(10)], now));
  });
});

describe("buildBroadcastEmail", () => {
  const base = { sellerName: "Maya", subject: " New chapter is out ", unsubscribeUrl: "https://halvo.io/unsubscribe?t=abc" };

  it("escapes the seller's text instead of rendering it as markup", () => {
    const { html } = buildBroadcastEmail({ ...base, body: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const { html } = buildBroadcastEmail({ ...base, body: "line one\nline two\n\nsecond para" });
    expect(html).toContain("line one<br>line two");
    expect((html.match(/<p style="margin:0 0 14px">/g) ?? []).length).toBe(2);
  });

  it("always carries the reason and the unsubscribe link, in both versions", () => {
    const { html, text, subject } = buildBroadcastEmail({ ...base, body: "hi" });
    expect(subject).toBe("New chapter is out");
    expect(html).toContain("because you bought from Maya");
    expect(html).toContain('href="https://halvo.io/unsubscribe?t=abc"');
    expect(text).toContain("Unsubscribe: https://halvo.io/unsubscribe?t=abc");
  });
});

describe("unsubscribe token", () => {
  const secret = "test-secret";

  it("round-trips seller and normalized email", async () => {
    const token = await signUnsubscribeToken("seller-1", " Buyer@X.com ", secret);
    expect(await verifyUnsubscribeToken(token, secret)).toEqual({ sellerId: "seller-1", email: "buyer@x.com" });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signUnsubscribeToken("seller-1", "b@x.com", secret);
    expect(await verifyUnsubscribeToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload (cannot unsubscribe someone else)", async () => {
    const token = await signUnsubscribeToken("seller-1", "b@x.com", secret);
    const [, sig] = token.split(".");
    const forgedPayload = btoa(JSON.stringify({ s: "seller-1", e: "victim@x.com" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyUnsubscribeToken(`${forgedPayload}.${sig}`, secret)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyUnsubscribeToken("", secret)).toBeNull();
    expect(await verifyUnsubscribeToken("nodot", secret)).toBeNull();
    expect(await verifyUnsubscribeToken("a.b.c", secret)).toBeNull();
  });
});
