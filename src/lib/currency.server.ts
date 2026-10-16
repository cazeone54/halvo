import { getRequest } from "@tanstack/react-start/server";
import {
  AUTO_CURRENCY_COOKIE,
  CURRENCY_COOKIE,
  currencyForCountry,
  currencyFromLanguages,
  DEFAULT_CURRENCY,
  isCurrency,
  type Currency,
} from "@/lib/currency";

function readCookie(header: string, name: string): string | undefined {
  return header.match(new RegExp(`(?:^|;\\s*)${name}=([a-z]+)`))?.[1];
}

// The currency to show the buyer making this request, from the strongest
// signal available:
//   1. their own choice ("Pay in … instead"),
//   2. the country Cloudflare reports, when the site is proxied through it,
//   3. what their browser's time zone said on an earlier page,
//   4. the region in their browser's language ("en-US", "en-GB"),
//   5. euros.
export function requestCurrency(): Currency {
  try {
    const { headers } = getRequest();
    const cookies = headers.get("cookie") ?? "";
    const chosen = readCookie(cookies, CURRENCY_COOKIE);
    if (isCurrency(chosen)) return chosen;
    const country = headers.get("cf-ipcountry");
    if (country && country !== "XX" && country !== "T1") return currencyForCountry(country);
    const auto = readCookie(cookies, AUTO_CURRENCY_COOKIE);
    if (isCurrency(auto)) return auto;
    return currencyFromLanguages(headers.get("accept-language")) ?? DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}
