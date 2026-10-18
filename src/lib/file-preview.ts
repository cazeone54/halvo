// What a seller can be shown of their own upload, without downloading it.
//
// Storage hands every file back as application/octet-stream whatever it is, so
// a browser tab can only ever download one — it can't display a PDF or an
// image. The dashboard therefore fetches the file and rebuilds it as a Blob
// carrying the type its name implies, and that type comes from here.
//
// Anything not listed (a zip, a .psd, an .exe) has nothing to show on screen,
// and is handed over as a download instead.

export type PreviewKind = "image" | "pdf" | "text" | "video" | "audio";

export type Preview = { kind: PreviewKind; mime: string };

const BY_EXTENSION: Record<string, Preview> = {
  png: { kind: "image", mime: "image/png" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  gif: { kind: "image", mime: "image/gif" },
  webp: { kind: "image", mime: "image/webp" },
  avif: { kind: "image", mime: "image/avif" },
  // SVG is deliberately absent: it can carry script, and this renders a file
  // we show to its owner in our own page.
  pdf: { kind: "pdf", mime: "application/pdf" },
  txt: { kind: "text", mime: "text/plain" },
  md: { kind: "text", mime: "text/plain" },
  csv: { kind: "text", mime: "text/plain" },
  json: { kind: "text", mime: "text/plain" },
  mp4: { kind: "video", mime: "video/mp4" },
  webm: { kind: "video", mime: "video/webm" },
  mp3: { kind: "audio", mime: "audio/mpeg" },
  wav: { kind: "audio", mime: "audio/wav" },
  m4a: { kind: "audio", mime: "audio/mp4" },
};

// Pulling a file into the page costs the seller's bandwidth and the browser's
// memory, so a large one is downloaded rather than shown.
export const MAX_INLINE_PREVIEW_BYTES = 25 * 1024 * 1024;

export function extensionOf(fileName: string | null | undefined): string {
  if (!fileName) return "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

// The preview to show for this file, or null when it should just be downloaded.
export function previewFor(
  fileName: string | null | undefined,
  sizeBytes?: number | null,
  maxBytes = MAX_INLINE_PREVIEW_BYTES,
): Preview | null {
  if (typeof sizeBytes === "number" && sizeBytes > maxBytes) return null;
  return BY_EXTENSION[extensionOf(fileName)] ?? null;
}

// Only the first part of a text file is rendered — a 20 MB CSV would otherwise
// freeze the page, and the point is to recognise the file, not read it.
export const TEXT_PREVIEW_CHARS = 20000;
