import { IMAGE_WIDTHS } from "@/lib/public-image-url";
import { isInOwnerFolder, isServableImageType } from "@/lib/owned-storage";

// Sends a public picture (a product cover or gallery image) from the private
// bucket ourselves, rather than redirecting to a signed Supabase link. A signed
// link is different every time one is made, so a browser could only keep the
// picture as long as the link lived — an hour. Supabase also resizes on the way
// out: `&w=400` gets a 400px-wide WebP, so a 180px thumbnail no longer
// downloads the 1600px PNG the seller uploaded.
//
// `currentUrl` is the address the site links to for this picture right now.
// When the request's `v` matches it, the response never changes and is cached
// for a year; an old `v` (the seller has since replaced the picture) gets the
// new picture, cached briefly.
//
// Because these bytes come from halvo.io itself, two rules guard them. The
// path must be in the product owner's own folder (a seller can set their
// product's image path to anything through the API), and only plain image
// types are sent — an SVG or HTML file served from our own origin could run
// script in a visitor's signed-in session. A deleted seller's kept products
// have no owner to check the folder against; nobody can create those.
export async function serveStoredImage(
  request: Request,
  path: string,
  currentUrl: string,
  ownerId: string | null,
): Promise<Response> {
  if (ownerId && !isInOwnerFolder(path, ownerId)) return new Response("Not found", { status: 404 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const params = new URL(request.url).searchParams;
  const width = Number(params.get("w"));
  const resize = (IMAGE_WIDTHS as readonly number[]).includes(width) ? width : null;
  const bucket = supabaseAdmin.storage.from("digital-assets");

  const fetchImage = async (width: number | null) => {
    // "contain" keeps the picture's shape. The default ("cover") keeps the
    // original height when only a width is given, so a 1600x900 cover asked
    // for at 400 came back as a 400x900 strip cut from its middle.
    const transform = width ? { transform: { width, resize: "contain" as const } } : undefined;
    const { data } = await bucket.createSignedUrl(path, 60, transform);
    if (!data?.signedUrl) return null;
    // Supabase chooses WebP from the Accept header, so pass the browser's on.
    const res = await fetch(data.signedUrl, { headers: { Accept: request.headers.get("accept") ?? "*/*" } });
    return res.ok && res.body ? res : null;
  };
  // If resizing ever fails (a plan limit, a file it can't read), the original
  // is still better than a broken image.
  const upstream = (resize ? await fetchImage(resize) : null) ?? (await fetchImage(null));
  if (!upstream) return new Response("Not found", { status: 404 });
  const contentType = upstream.headers.get("content-type");
  if (!isServableImageType(contentType)) {
    await upstream.body?.cancel();
    return new Response("Not found", { status: 404 });
  }

  const current = params.get("v") === new URL(currentUrl, "http://x").searchParams.get("v");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType!,
      "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
      Vary: "Accept",
      // Belt and braces: even if a browser rendered this as a document, it
      // could load nothing and run nothing.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
