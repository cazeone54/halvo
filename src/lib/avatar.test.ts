import { describe, expect, it } from "vitest";
import { initialsFor, isOwnStoredImage, isStoredAvatarPath, trustedExternalAvatar } from "./avatar";

describe("trustedExternalAvatar", () => {
  it("accepts Google's photo links — what a Google sign-up actually stores", () => {
    const g = "https://lh3.googleusercontent.com/a/ACg8ocJ123=s96-c";
    expect(trustedExternalAvatar(g)).toBe(g);
  });

  it("refuses every other host, so the avatar route can't become an open redirect", () => {
    for (const bad of [
      "https://evil.example/me.png",
      "https://googleusercontent.com.evil.example/x",
      "https://lh3.googleusercontent.com.evil.example/x",
      "https://evil.example/?u=https://lh3.googleusercontent.com/a",
    ]) {
      expect(trustedExternalAvatar(bad), bad).toBeNull();
    }
  });

  it("refuses plain http and non-URLs", () => {
    expect(trustedExternalAvatar("http://lh3.googleusercontent.com/a/x")).toBeNull();
    expect(trustedExternalAvatar("javascript:alert(1)")).toBeNull();
    expect(trustedExternalAvatar("uid/avatar/123-me.png")).toBeNull();
    expect(trustedExternalAvatar(null)).toBeNull();
    expect(trustedExternalAvatar("")).toBeNull();
  });
});

describe("isStoredAvatarPath", () => {
  it("is true for a path in our bucket", () => {
    expect(isStoredAvatarPath("f0f1b27b/avatar/1700000000-me.png")).toBe(true);
  });

  it("is false for any URL — the bug was treating a Google link as a storage path", () => {
    expect(isStoredAvatarPath("https://lh3.googleusercontent.com/a/x")).toBe(false);
    expect(isStoredAvatarPath("http://x/y")).toBe(false);
    expect(isStoredAvatarPath("data:image/png;base64,AAA")).toBe(false);
  });

  it("is false for nothing", () => {
    expect(isStoredAvatarPath(null)).toBe(false);
    expect(isStoredAvatarPath(undefined)).toBe(false);
    expect(isStoredAvatarPath("")).toBe(false);
  });
});

describe("isOwnStoredImage", () => {
  it("accepts a file in the user's own folder of that kind", () => {
    expect(isOwnStoredImage("u1/avatar/1700-me.png", "u1", "avatar")).toBe(true);
    expect(isOwnStoredImage("u1/banner/1700-top.jpg", "u1", "banner")).toBe(true);
  });

  it("refuses anyone else's file, a paid download above all", () => {
    expect(isOwnStoredImage("u2/avatar/1700-me.png", "u1", "avatar")).toBe(false);
    expect(isOwnStoredImage("u1/p9/1700-course.pdf", "u1", "avatar")).toBe(false);
    expect(isOwnStoredImage("u1/avatar/../p9/course.pdf", "u1", "avatar")).toBe(false);
    expect(isOwnStoredImage("u1/banner/1700-top.jpg", "u1", "avatar")).toBe(false);
  });

  it("refuses URLs and nothing", () => {
    expect(isOwnStoredImage("https://lh3.googleusercontent.com/a/x", "u1", "avatar")).toBe(false);
    expect(isOwnStoredImage(null, "u1", "banner")).toBe(false);
  });
});

describe("initialsFor", () => {
  it("takes first and last word", () => {
    expect(initialsFor("Petar Yakimov")).toBe("PY");
    expect(initialsFor("Mary Jane Watson")).toBe("MW");
  });

  it("handles handles and single names", () => {
    expect(initialsFor("grando")).toBe("G");
    expect(initialsFor("halvo-press")).toBe("HP");
    expect(initialsFor("bogomil_dochev")).toBe("BD");
  });

  it("works for Cyrillic names", () => {
    expect(initialsFor("Петър Якимов")).toBe("ПЯ");
  });

  it("ignores stray punctuation and spacing", () => {
    expect(initialsFor("  ana  ")).toBe("A");
    expect(initialsFor("(ana) [smith]")).toBe("AS");
  });

  it("returns null when there's nothing to use", () => {
    expect(initialsFor(null)).toBeNull();
    expect(initialsFor("")).toBeNull();
    expect(initialsFor("  --  ")).toBeNull();
  });
});
