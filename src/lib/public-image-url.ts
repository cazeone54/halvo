// Public product/profile images are served through stable proxy routes
// (img.product.$productId.ts / img.avatar.$userId.ts) that sign a fresh URL
// on every request, rather than embedding a short-lived signed URL directly
// in a page. That matters most for og:image — a platform re-fetching a link
// preview later would hit a dead signed URL otherwise.
//
// Those routes let the redirect be cached for 55 minutes, which is what makes
// a thumbnail grid cheap. The catch: the address is the same before and after
// a seller replaces the picture, so the browser happily serves the old one and
// the seller thinks the upload failed. The `v` below is what fixes that — it's
// derived from the stored file path, upload names carry a timestamp, so a new
// picture produces an address the browser has never seen. The routes look the
// image up by id and ignore `v` entirely.

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

export function avatarImageUrl(userId: string, avatarPath: string | null): string | null {
  return avatarPath ? `/img/avatar/${userId}?v=${version(avatarPath)}` : null;
}

export function bannerImageUrl(userId: string, bannerPath: string | null | undefined): string | null {
  return bannerPath ? `/img/banner/${userId}?v=${version(bannerPath)}` : null;
}
