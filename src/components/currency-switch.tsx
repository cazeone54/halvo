import { CURRENCY_COOKIE, CURRENCY_META, type Currency } from "@/lib/currency";

// Prices follow the buyer's country; this lets someone abroad (or using a VPN)
// pay in the other currency. Remembered for a year, then the page reloads so
// every price and the checkout are rebuilt in the new currency.
// `className` so the same control can sit centred under a checkout button or
// left-aligned in a page header without each caller rebuilding it.
//
// `seller`: on the dashboard nobody is paying — the seller is choosing which
// currency to read their own numbers in — so it says "Show" instead of "Pay".
export function CurrencySwitch({
  current,
  className = "mt-2 text-center text-xs text-muted-foreground",
  seller = false,
}: {
  current: Currency;
  className?: string;
  seller?: boolean;
}) {
  const other: Currency = current === "eur" ? "usd" : "eur";
  const choose = () => {
    document.cookie = `${CURRENCY_COOKIE}=${other}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  };
  return (
    <p className={className}>
      {seller ? "Shown in" : "Prices in"} {CURRENCY_META[current].name} ·{" "}
      <button type="button" onClick={choose} className="underline underline-offset-2 hover:text-foreground">
        {seller ? "Show" : "Pay"} in {CURRENCY_META[other].name} instead
      </button>
    </p>
  );
}
