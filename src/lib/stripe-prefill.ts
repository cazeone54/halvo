// What Halvo fills in on a seller's new Stripe account, so Stripe's first
// screen asks less. In Nov 2026, all 5 new sellers who opened Stripe left on
// that first screen, which asks a person selling one guide for a "business
// website" and a description of their business.
//
// Only what Halvo knows for certain: the seller's public Halvo page as the
// website, and that they sell digital products. Whether they're an individual
// or a company, and their industry, stay the seller's own answers — a wrong
// guess there would be worse than one click.

export type PrefillProduct = { name: string; slug: string | null; free: boolean };

export function stripeProfilePrefill(args: {
  baseUrl: string;
  handle: string | null;
  products: PrefillProduct[];
}): { businessUrl: string | null; productDescription: string } {
  // A page Stripe's reviewers can open. The shop page is always public; a
  // product page only if it's live and free (a paid product stays hidden until
  // Stripe is connected, so its link would show them nothing).
  const freeLive = args.products.find((p) => p.slug && p.free);
  const businessUrl = args.handle
    ? `${args.baseUrl}/${args.handle}`
    : freeLive
      ? `${args.baseUrl}/p/${freeLive.slug}`
      : null;

  const names = args.products
    .map((p) => p.name.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((n) => `"${n.length > 60 ? `${n.slice(0, 59)}…` : n}"`);
  const productDescription =
    "Digital products (downloadable files and online templates) sold to customers through the seller's shop on Halvo (halvo.io)." +
    (names.length ? ` Products include ${names.join(", ")}.` : "");

  return { businessUrl, productDescription };
}
