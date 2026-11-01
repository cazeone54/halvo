// Public product/profile images are served through stable proxy routes
// (img.product.$productId.ts / img.avatar.$userId.ts) rather than a
// short-lived signed URL embedded in a page. That matters most for og:image —
// a platform re-fetching a link preview later would hit a dead signed URL
// otherwise.
//
// The address stays the same while the picture does, so it can be cached. The
// `v` below is what makes that safe — it's derived from the stored file path,
// upload names carry a timestamp, so a new picture produces an address the
// browser has never seen. The routes look the image up by id; the product and
// gallery routes only cache for a long time when `v` is the current one.

// Small, fast, stable string hash (FNV-1a). Not security — just a short tag
// that changes whenever the path does, and is identical on server and client
// so the markup doesn't differ between the two.
function version(path: string): string {
  let hash = 2166136261;
  for (let i = 0; i < path.length; i++) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function productImageUrl(productId: string, imagePath: string | null): string | null {
  return imagePath ? `/img/product/${productId}?v=${version(imagePath)}` : null;
}

// The widths the product and gallery image routes resize to (`&w=`). Anything
// else gets the original file.
export const IMAGE_WIDTHS = [200, 400, 800, 1600] as const;

// Props for an <img> showing a product or gallery image: every width, so the
// browser downloads the smallest one that's sharp in the slot. `sizes` says how
// wide the slot is, e.g. "(min-width: 1024px) 280px, 50vw".
export function responsiveImage(url: string, sizes: string) {
  return {
    src: `${url}&w=800`,
    srcSet: IMAGE_WIDTHS.map((w) => `${url}&w=${w} ${w}w`).join(", "),
    sizes,
  };
}

export function avatarImageUrl(userId: string, avatarPath: string | null): string | null {
  return avatarPath ? `/img/avatar/${userId}?v=${version(avatarPath)}` : null;
}

export function bannerImageUrl(userId: string, bannerPath: string | null | undefined): string | null {
  return bannerPath ? `/img/banner/${userId}?v=${version(bannerPath)}` : null;
}
