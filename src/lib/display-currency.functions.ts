import { createServerFn } from "@tanstack/react-start";
import { requestCurrency } from "@/lib/currency.server";

// Which currency to render this person's dashboard in.
//
// The dashboard has no loader of its own and the choice lives in a cookie the
// server reads, so there's no way to know it on the client without asking.
// It's the same cookie the storefront switch sets, so a seller who flips to
// dollars on their own product page sees dollars here too — one preference,
// not two that can disagree.
export const getDisplayCurrency = createServerFn({ method: "GET" }).handler(async () => {
  return { currency: requestCurrency() };
});
