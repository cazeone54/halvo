-- Halvo — where a sale actually came from.
--
-- Sellers could see revenue and sales but had no idea which link or platform
-- produced them, which is the first question anyone asks. Deliberately a
-- separate table rather than a column on transactions: the source is written
-- best-effort *after* the purchase is already recorded, so a failure here (or
-- this migration not being applied yet) can never break a checkout that the
-- buyer has already paid for.

create table public.sale_sources (
  id uuid primary key default gen_random_uuid(),
  -- Unique: one recorded source per sale, so a retry can't double-count.
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  seller_id uuid references auth.users(id) on delete set null,
  source text not null,
  created_at timestamptz not null default now()
);

create index sale_sources_seller_idx on public.sale_sources(seller_id, created_at);

alter table public.sale_sources enable row level security;

-- Written only by the service-role client during checkout (no anon/authenticated
-- INSERT policy). Sellers read their own for the analytics page.
create policy "Sellers can view their own sale sources"
  on public.sale_sources for select
  using (auth.uid() = seller_id);
