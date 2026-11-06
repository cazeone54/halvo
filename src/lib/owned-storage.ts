// Ownership rules for anything served or delivered from the private bucket.
//
// Storage paths are "<owner id>/...", and storage only lets a user write inside
// their own folder. But the rows that POINT at files and products — a product's
// cover, a product_files row, a bundle item, an order bump — are written by
// sellers, and the database only checks that the row is theirs, not that what
// it points at is. So everything that reads those rows with the service role
// re-checks here: a seller can only ever reach their own products and files.
// Pure, so the rules are tested rather than assumed.

export function isInOwnerFolder(path: string | null | undefined, ownerId: string | null | undefined): path is string {
  return !!path && !!ownerId && path.startsWith(`${ownerId}/`) && !path.split("/").includes("..");
}

// Cover and gallery images are sent from halvo.io itself, so only plain image
// types: an SVG or HTML "image" served from our own origin could run script
// with access to a signed-in visitor's session.
const SERVABLE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export function isServableImageType(contentType: string | null | undefined): boolean {
  return SERVABLE_IMAGE_TYPES.has((contentType ?? "").split(";")[0].trim().toLowerCase());
}

// Two things belong to the same seller. A deleted seller's kept products and
// files both lose their owner (null) together — see migration 0022 — so null
// matches null, but never a real id, and "not found" (undefined) matches nothing.
export function sameOwner(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return a === b;
}

// A file a buyer of a product may receive: added by that product's own seller,
// and stored in that seller's folder.
export function isSellersFile(
  file: { owner_id: string | null; storage_file_path: string },
  productOwnerId: string | null | undefined,
): boolean {
  if (!sameOwner(file.owner_id, productOwnerId)) return false;
  // A deleted seller's kept files can't be matched to a folder any more; nobody
  // can create ownerless rows, so these are only ever the seller's own.
  if (productOwnerId === null) return true;
  return isInOwnerFolder(file.storage_file_path, productOwnerId);
}
