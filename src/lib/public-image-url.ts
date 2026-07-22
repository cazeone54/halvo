// Public product/profile images are served through stable proxy routes
// (img.product.$productId.ts / img.avatar.$userId.ts) that sign a fresh URL
// on every request, rather than embedding a short-lived signed URL directly
// in a page. That matters most for og:image — a platform re-fetching a link
// preview later would hit a dead signed URL otherwise.
export function productImageUrl(productId: string, imagePath: string | null): string | null {
  return imagePath ? `/img/product/${productId}` : null;
}

export function avatarImageUrl(userId: string, avatarPath: string | null): string | null {
  return avatarPath ? `/img/avatar/${userId}` : null;
}
