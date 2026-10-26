import { describe, expect, it } from "vitest";
import {
  bioLinksForDisplay,
  isLikelyBot,
  isReservedHandle,
  normalizeBioLinks,
  normalizeSocial,
  normalizeSocialLinks,
  normalizeUrl,
  socialLinksForDisplay,
} from "./link-in-bio";

describe("normalizeUrl", () => {
  it("adds https:// to an address typed without it", () => {
    expect(normalizeUrl("mysite.com/shop")).toEqual({ ok: true, value: "https://mysite.com/shop" });
  });

  it("refuses anything that could run code or isn't a website", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://files.example.com", "http://localhost:3000", "hello"]) {
      expect(normalizeUrl(bad).ok).toBe(false);
    }
  });

  it("refuses a link with a login in it", () => {
    expect(normalizeUrl("https://user:pass@example.com").ok).toBe(false);
  });
});

describe("normalizeSocial", () => {
  it("turns a username into a profile link, with or without the @", () => {
    expect(normalizeSocial("instagram", "@maria")).toEqual({ ok: true, value: "https://www.instagram.com/maria/" });
    expect(normalizeSocial("tiktok", "maria")).toEqual({ ok: true, value: "https://www.tiktok.com/@maria" });
    expect(normalizeSocial("x", "@maria_l")).toEqual({ ok: true, value: "https://x.com/maria_l" });
  });

  it("treats a dotted username as a username, not a website", () => {
    expect(normalizeSocial("instagram", "maria.lopez")).toEqual({
      ok: true,
      value: "https://www.instagram.com/maria.lopez/",
    });
  });

  it("keeps a pasted link that is on the right platform, upgraded to https", () => {
    expect(normalizeSocial("instagram", "http://instagram.com/maria")).toEqual({
      ok: true,
      value: "https://instagram.com/maria",
    });
    expect(normalizeSocial("youtube", "https://m.youtube.com/@maria")).toEqual({
      ok: true,
      value: "https://m.youtube.com/@maria",
    });
    expect(normalizeSocial("instagram", "www.instagram.com/maria")).toEqual({
      ok: true,
      value: "https://www.instagram.com/maria",
    });
  });

  it("refuses a link to a different site in a platform's box", () => {
    const r = normalizeSocial("instagram", "https://evil.example.com/instagram.com");
    expect(r.ok).toBe(false);
  });

  it("an empty box means remove it", () => {
    expect(normalizeSocial("tiktok", "   ")).toEqual({ ok: true, value: null });
  });

  it("accepts any real website for the website box", () => {
    expect(normalizeSocial("website", "maria-yoga.com")).toEqual({ ok: true, value: "https://maria-yoga.com/" });
  });
});

describe("normalizeSocialLinks", () => {
  it("names the platform when one box is wrong", () => {
    const r = normalizeSocialLinks({ instagram: "@maria", x: "this is not a name!" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("X:") });
  });

  it("drops empty boxes", () => {
    expect(normalizeSocialLinks({ instagram: "@maria", tiktok: "" })).toEqual({
      ok: true,
      value: { instagram: "https://www.instagram.com/maria/" },
    });
  });
});

describe("normalizeBioLinks", () => {
  let n = 0;
  const newId = () => `generated-${String(++n).padStart(4, "0")}`;

  it("keeps a link's id across saves, so its clicks stay with it", () => {
    const r = normalizeBioLinks([{ id: "11111111-aaaa", title: "  My   course ", url: "mysite.com/course" }], newId);
    expect(r).toEqual({ ok: true, value: [{ id: "11111111-aaaa", title: "My course", url: "https://mysite.com/course" }] });
  });

  it("gives new links and duplicated ids a fresh id", () => {
    const r = normalizeBioLinks(
      [
        { title: "A", url: "a.com" },
        { id: "22222222-bbbb", title: "B", url: "b.com" },
        { id: "22222222-bbbb", title: "C", url: "c.com" },
      ],
      newId,
    );
    if (!r.ok) throw new Error(r.error);
    const ids = r.value.map((l) => l.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[1]).toBe("22222222-bbbb");
  });

  it("refuses more than six links, a missing title, or a bad link", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ title: `L${i}`, url: "a.com" }));
    expect(normalizeBioLinks(seven, newId).ok).toBe(false);
    expect(normalizeBioLinks([{ title: " ", url: "a.com" }], newId).ok).toBe(false);
    expect(normalizeBioLinks([{ title: "x", url: "javascript:alert(1)" }], newId).ok).toBe(false);
  });
});

describe("reading stored values back", () => {
  it("skips anything that no longer passes, whatever got into the database", () => {
    expect(
      socialLinksForDisplay({ instagram: "https://www.instagram.com/maria/", x: "javascript:alert(1)", nope: "https://a.com" }),
    ).toEqual([{ platform: "instagram", label: "Instagram", url: "https://www.instagram.com/maria/" }]);
    expect(
      bioLinksForDisplay([
        { id: "33333333-cccc", title: "Good", url: "https://a.com/" },
        { id: "short", title: "Bad id", url: "https://a.com/" },
        { id: "44444444-dddd", title: "Bad url", url: "javascript:alert(1)" },
        "not an object",
      ]),
    ).toEqual([{ id: "33333333-cccc", title: "Good", url: "https://a.com/" }]);
    expect(socialLinksForDisplay(null)).toEqual([]);
    expect(bioLinksForDisplay({})).toEqual([]);
  });
});

describe("isReservedHandle", () => {
  it("keeps the site's own page names", () => {
    expect(isReservedHandle("pricing")).toBe(true);
    expect(isReservedHandle("Dashboard")).toBe(true);
    expect(isReservedHandle("maria")).toBe(false);
    expect(isReservedHandle("halvo-press")).toBe(false);
  });
});

describe("isLikelyBot", () => {
  it("counts people in Instagram's browser, not link previews or scripts", () => {
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 350.0")).toBe(false);
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot("WhatsApp/2.24")).toBe(true);
    expect(isLikelyBot("curl/8.0")).toBe(true);
    expect(isLikelyBot("")).toBe(true);
  });
});
