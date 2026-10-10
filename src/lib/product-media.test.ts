import { describe, expect, it } from "vitest";
import { buildMediaItems, galleryImageUrls, isOwnProductPath, parseVideoUrl } from "./product-media";

describe("parseVideoUrl", () => {
  it("accepts the common YouTube link shapes and embeds via youtube-nocookie", () => {
    const want = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0";
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(u)).toEqual({ provider: "YouTube", embedUrl: want });
    }
  });

  it("accepts Vimeo, keeping the privacy hash of unlisted videos", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?autoplay=1",
    );
    expect(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?autoplay=1&h=8272103f6e",
    );
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")?.provider).toBe("Vimeo");
  });

  it("accepts Loom share links", () => {
    expect(parseVideoUrl("https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184")?.embedUrl).toBe(
      "https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184?autoplay=1",
    );
  });

  it("rejects other hosts, bad ids, and non-http schemes", () => {
    for (const u of [
      "",
      "not a url",
      "javascript:alert(1)",
      "https://evil.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload",
      "https://vimeo.com/channels/staffpicks",
      "https://www.loom.com/share/not-an-id",
    ]) {
      expect(parseVideoUrl(u)).toBeNull();
    }
  });
});

describe("galleryImageUrls", () => {
  it("gives each image a stable URL whose version changes with the file", () => {
    const [a, b] = galleryImageUrls("p1", ["u/p1/a.png", "u/p1/b.png"]);
    expect(a).toMatch(/^\/img\/gallery\/p1\/0\?v=\w+$/);
    expect(b).toMatch(/^\/img\/gallery\/p1\/1\?v=\w+$/);
    // After removing the first image, index 0 now holds b — the URL must differ.
    expect(galleryImageUrls("p1", ["u/p1/b.png"])[0]).not.toBe(a);
  });
  it("handles missing paths", () => {
    expect(galleryImageUrls("p1", null)).toEqual([]);
  });
});

describe("isOwnProductPath", () => {
  it("only accepts paths inside the seller's product folder", () => {
    expect(isOwnProductPath("u1/p1/gallery-1.png", "u1", "p1")).toBe(true);
    expect(isOwnProductPath("u2/p1/gallery-1.png", "u1", "p1")).toBe(false);
    expect(isOwnProductPath("u1/p2/file.pdf", "u1", "p1")).toBe(false);
    expect(isOwnProductPath("u1/p1/../../u2/x.pdf", "u1", "p1")).toBe(false);
    expect(isOwnProductPath("u1/p1/gallery-1-my..shot.png", "u1", "p1")).toBe(true);
  });
});

describe("buildMediaItems", () => {
  const video = { provider: "YouTube" as const, embedUrl: "https://www.youtube-nocookie.com/embed/x" };
  it("orders cover, video, gallery", () => {
    const items = buildMediaItems({ name: "Kit", coverUrl: "/c", video, galleryUrls: ["/g0", "/g1"] });
    expect(items.map((i) => i.kind)).toEqual(["image", "video", "image", "image"]);
    expect(items[2]).toEqual({ kind: "image", src: "/g0", alt: "Kit — image 2" });
  });
  it("is empty when there is no media at all", () => {
    expect(buildMediaItems({ name: "Kit", coverUrl: null, video: null, galleryUrls: [] })).toEqual([]);
  });
});
