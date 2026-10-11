-- Halvo — honest scarcity: limited copies and a launch price that really ends.
--
-- stock_limit:      max number of successful sales (null = unlimited).
-- sale_price_cents: a lower price that applies until sale_ends_at; after that
--                   checkout charges price_cents again automatically.
--
-- Both are enforced at checkout. The app degrades safely without this
-- migration: products simply have no limit and no sale.

alter table public.products add column if not exists stock_limit integer;
alter table public.products add column if not exists sale_price_cents integer;
alter table public.products add column if not exists sale_ends_at timestamptz;

alter table public.products drop constraint if exists products_stock_limit_positive;
alter table public.products add constraint products_stock_limit_positive check (stock_limit is null or stock_limit > 0);

alter table public.products drop constraint if exists products_sale_complete;
alter table public.products add constraint products_sale_complete
  check ((sale_price_cents is null) = (sale_ends_at is null) and (sale_price_cents is null or sale_price_cents >= 0));
