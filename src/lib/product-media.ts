// Product page media: which video links are allowed, how they embed, and the
// stable public URLs for gallery images. Pure, so it's unit-tested.

export const MAX_GALLERY_IMAGES = 6;

export type VideoEmbed = { provider: "YouTube" | "Vimeo" | "Loom"; embedUrl: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

// Only these three players can ever be framed: the embed URL is rebuilt from
// the parsed id, never taken from the seller's input.
export function parseVideoUrl(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") id = parts[1] ?? null;
    if (!id || !YT_ID.test(id)) return null;
    return { provider: "YouTube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const rest = host === "player.vimeo.com" && parts[0] === "video" ? parts.slice(1) : parts;
    const id = rest[0];
    if (!id || !/^\d{1,12}$/.test(id)) return null;
    // Unlisted videos carry a privacy hash, either as /ID/HASH or ?h=HASH.
    const hash = rest[1] ?? url.searchParams.get("h");
    const h = hash && /^[0-9a-f]{6,20}$/i.test(hash) ? `&h=${hash}` : "";
    return { provider: "Vimeo", embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1${h}` };
  }

  if (host === "loom.com") {
    const id = parts[0] === "share" || parts[0] === "embed" ? parts[1] : null;
    if (!id || !/^[0-9a-f]{32}$/i.test(id)) return null;
    return { provider: "Loom", embedUrl: `https://www.loom.com/embed/${id}?autoplay=1` };
  }

  return null;
}

// The version suffix changes whenever the image at an index changes, so a
// browser never shows a stale cached redirect after a removal shifts indices.
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function galleryImageUrls(productId: string, paths: readonly string[] | null | undefined): string[] {
  return (paths ?? []).map((p, i) => `/img/gallery/${productId}/${i}?v=${shortHash(p)}`);
}

// A storage path belongs to this seller's product only if it lives in that
// product's folder — stops a seller pointing public media at someone else's file.
export function isOwnProductPath(path: string, userId: string, productId: string): boolean {
  return path.startsWith(`${userId}/${productId}/`) && !path.split("/").includes("..");
}

export type MediaItem =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; video: VideoEmbed };

// Cover first (it's what the listing showed), then the video, then the gallery.
export function buildMediaItems(opts: {
  name: string;
  coverUrl: string | null;
  video: VideoEmbed | null;
  galleryUrls: string[];
}): MediaItem[] {
  const items: MediaItem[] = [];
  if (opts.coverUrl) items.push({ kind: "image", src: opts.coverUrl, alt: opts.name });
  if (opts.video) items.push({ kind: "video", video: opts.video });
  opts.galleryUrls.forEach((src, i) =>
    items.push({ kind: "image", src, alt: `${opts.name} — image ${i + (opts.coverUrl ? 2 : 1)}` }),
  );
  return items;
}
