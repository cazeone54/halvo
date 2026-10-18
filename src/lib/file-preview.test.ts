import { describe, it, expect } from "vitest";
import { extensionOf, MAX_INLINE_PREVIEW_BYTES, previewFor } from "./file-preview";

describe("deciding what a seller can be shown", () => {
  it("shows the file types a browser can actually render", () => {
    expect(previewFor("cover.png")).toEqual({ kind: "image", mime: "image/png" });
    expect(previewFor("guide.PDF")).toEqual({ kind: "pdf", mime: "application/pdf" });
    expect(previewFor("notes.md")).toMatchObject({ kind: "text" });
    expect(previewFor("lesson.mp4")).toMatchObject({ kind: "video" });
    expect(previewFor("track.mp3")).toMatchObject({ kind: "audio" });
  });

  it("downloads anything it can't show", () => {
    expect(previewFor("bundle.zip")).toBeNull();
    expect(previewFor("design.psd")).toBeNull();
    expect(previewFor("noextension")).toBeNull();
    expect(previewFor("")).toBeNull();
    expect(previewFor(null)).toBeNull();
  });

  it("never renders an SVG, which can carry script", () => {
    expect(previewFor("logo.svg")).toBeNull();
  });

  it("downloads a file too big to pull into the page", () => {
    expect(previewFor("huge.pdf", MAX_INLINE_PREVIEW_BYTES + 1)).toBeNull();
    expect(previewFor("fine.pdf", MAX_INLINE_PREVIEW_BYTES)).toMatchObject({ kind: "pdf" });
    expect(previewFor("unknown-size.pdf", null)).toMatchObject({ kind: "pdf" });
  });

  it("reads the extension off the end of the name", () => {
    expect(extensionOf("a.b.c.PNG")).toBe("png");
    expect(extensionOf("trailing.")).toBe("");
    expect(extensionOf("none")).toBe("");
  });
});
