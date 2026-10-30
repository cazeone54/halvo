import { describe, expect, it } from "vitest";
import { MAX_ANNOUNCEMENT, announcementForDisplay, normalizeAnnouncement } from "./shop-look";

describe("normalizeAnnouncement", () => {
  it("empty means no announcement", () => {
    expect(normalizeAnnouncement({ text: "  ", url: "" })).toEqual({ ok: true, value: null });
  });

  it("tidies the text and keeps a link optional", () => {
    expect(normalizeAnnouncement({ text: "  New course   out Friday ", url: "" })).toEqual({
      ok: true,
      value: { text: "New course out Friday", url: null },
    });
  });

  it("adds https:// to a typed address", () => {
    const r = normalizeAnnouncement({ text: "Join the list", url: "example.com/list" });
    expect(r).toEqual({ ok: true, value: { text: "Join the list", url: "https://example.com/list" } });
  });

  it("refuses a link without text, and text that's too long", () => {
    expect(normalizeAnnouncement({ text: "", url: "https://example.com" }).ok).toBe(false);
    expect(normalizeAnnouncement({ text: "x".repeat(MAX_ANNOUNCEMENT + 1), url: "" }).ok).toBe(false);
  });

  it("refuses links that aren't web addresses", () => {
    expect(normalizeAnnouncement({ text: "Hi", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(normalizeAnnouncement({ text: "Hi", url: "data:text/html,x" }).ok).toBe(false);
  });
});

describe("announcementForDisplay", () => {
  it("shows a stored announcement that still passes the rules", () => {
    expect(announcementForDisplay("Sale ends Sunday", "https://halvo.io/x")).toEqual({
      text: "Sale ends Sunday",
      url: "https://halvo.io/x",
    });
  });

  it("shows nothing for missing or invalid values", () => {
    expect(announcementForDisplay(null, null)).toBeNull();
    expect(announcementForDisplay("Hi", "javascript:alert(1)")).toBeNull();
    expect(announcementForDisplay(42, null)).toBeNull();
  });
});
