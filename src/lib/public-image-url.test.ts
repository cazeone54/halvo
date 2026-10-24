import { describe, expect, it } from "vitest";
import { avatarImageUrl, productImageUrl } from "./public-image-url";

const PRODUCT = "793dce45-fab6-4d17-956a-496e4d0f267b";
const USER = "f0f1b27b-e1aa-442c-bf06-b087b3a66a2a";

describe("productImageUrl", () => {
  it("points at the stable proxy route", () => {
    expect(productImageUrl(PRODUCT, "uid/pid/cover-1700000000-a.png")).toMatch(
      new RegExp(`^/img/product/${PRODUCT}\\?v=`),
    );
  });

  it("is null when there's no image", () => {
    expect(productImageUrl(PRODUCT, null)).toBeNull();
    expect(productImageUrl(PRODUCT, "")).toBeNull();
  });

  it("changes when the picture changes — the whole point", () => {
    // Replacing a cover used to leave the address identical, so the browser
    // kept showing the old picture for the cache lifetime of the redirect.
    const before = productImageUrl(PRODUCT, "uid/pid/cover-1700000000-old.png");
    const after = productImageUrl(PRODUCT, "uid/pid/cover-1800000000-new.png");
    expect(after).not.toBe(before);
  });

  it("is stable for the same picture, so caching still works", () => {
    const path = "uid/pid/cover-1700000000-a.png";
    expect(productImageUrl(PRODUCT, path)).toBe(productImageUrl(PRODUCT, path));
  });

  it("gives different products different addresses", () => {
    const path = "uid/pid/cover-1700000000-a.png";
    expect(productImageUrl(PRODUCT, path)).not.toBe(productImageUrl(USER, path));
  });
});

describe("avatarImageUrl", () => {
  it("versions the avatar the same way", () => {
    const before = avatarImageUrl(USER, "uid/avatar/1700000000-me.png");
    const after = avatarImageUrl(USER, "uid/avatar/1800000000-me.png");
    expect(before).toMatch(new RegExp(`^/img/avatar/${USER}\\?v=`));
    expect(after).not.toBe(before);
  });

  it("handles a Google photo URL as the stored value", () => {
    // Google sign-ups store a full URL rather than a storage path.
    expect(avatarImageUrl(USER, "https://lh3.googleusercontent.com/a/ACg8ocJ123=s96-c")).toMatch(
      new RegExp(`^/img/avatar/${USER}\\?v=`),
    );
  });

  it("is null when there's no avatar", () => {
    expect(avatarImageUrl(USER, null)).toBeNull();
  });
});
