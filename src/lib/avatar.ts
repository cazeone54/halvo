// What profiles.avatar_url can hold, and how to show someone with no photo.
//
// avatar_url holds one of two very different things:
//
//   * a path in our storage bucket ("<uid>/avatar/123-me.png") — written by
//     setMyAvatar when someone uploads a photo in Settings
//   * a full https URL — written by the signup trigger, which copies the
//     identity provider's photo (Google's lh3.googleusercontent.com link)
//
// Everything used to assume the first. The avatar route then tried to sign a
// storage URL for "https://lh3.googleusercontent.com/...", found nothing, and
// every Google sign-up got a broken image in the header.

/**
 * Hosts whose photo URLs we'll redirect to. Deliberately an allow-list:
 * user_metadata is client-writable on email sign-up, so without it anyone could
 * set avatar_url to any address and turn /img/avatar/<id> into an open redirect
 * from halvo.io — or put an arbitrary image on their public storefront.
 */
const TRUSTED_PHOTO_HOSTS = [/^lh\d\.googleusercontent\.com$/, /^[a-z0-9-]+\.googleusercontent\.com$/];

/** A provider photo we're willing to redirect to, or null. */
export function trustedExternalAvatar(value: string | null | undefined): string | null {
  if (!value || !/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return TRUSTED_PHOTO_HOSTS.some((re) => re.test(url.hostname)) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** True when the value is a path in our own storage bucket (not a URL). */
export function isStoredAvatarPath(value: string | null | undefined): value is string {
  return !!value && !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

/**
 * True when a stored path sits in that user's own folder of that kind
 * ("<uid>/avatar/…", "<uid>/banner/…"). A profile's columns can be written by
 * its owner straight through the API, so the image routes check this before
 * signing anything — otherwise a profile could point at someone else's file,
 * a paid download included, and have it served as a picture.
 */
export function isOwnStoredImage(
  value: string | null | undefined,
  userId: string,
  folder: "avatar" | "banner",
): value is string {
  return isStoredAvatarPath(value) && value.startsWith(`${userId}/${folder}/`) && !value.split("/").includes("..");
}

/**
 * Up to two initials for the placeholder: "Petar Yakimov" -> "PY",
 * "grando" -> "G", "halvo-press" -> "HP". Null when there's nothing usable,
 * so the caller can fall back to an icon.
 */
export function initialsFor(name: string | null | undefined): string | null {
  const words = (name ?? "")
    .split(/[\s._-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return null;
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join("").toUpperCase();
}
