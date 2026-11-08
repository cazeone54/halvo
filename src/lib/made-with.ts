import { BASE_URL } from "@/lib/site";

// Every buyer of a Halvo product is someone who might sell their own. The
// pages and emails a buyer sees carry one small invitation, each tagged with
// where it was, so the owner's funnel page (/dashboard/funnel, "Where sign-ups
// came from") shows which of them brings sellers.
//
// A full link, not an in-app one: the arrival tag is read when the site loads
// (rememberArrival in __root), which a client-side navigation would skip.
export type MadeWithPlace = "product_page" | "embed" | "shop_page" | "success_page" | "email";

export function madeWithUrl(place: MadeWithPlace): string {
  return `${BASE_URL}/?utm_source=made_with_halvo&utm_medium=${place}`;
}
