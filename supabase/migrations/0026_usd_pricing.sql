-- Halvo — euros for buyers in Europe, US dollars for everyone else.
--
-- Prices stay stored in euros. A seller may set their own dollar price;
-- without one the dollar price is the same number (€19 → $19). See
-- src/lib/currency.ts.
alter table public.products
  add column if not exists price_usd_cents integer
  check (price_usd_cents is null or price_usd_cents > 0);

-- Every sale and subscription records the currency it was charged in, so
-- totals are never added across currencies. Everything before this was euros.
alter table public.transactions
  add column if not exists currency text not null default 'eur'
  check (currency in ('eur', 'usd'));

alter table public.buyer_subscriptions
  add column if not exists currency text not null default 'eur'
  check (currency in ('eur', 'usd'));
