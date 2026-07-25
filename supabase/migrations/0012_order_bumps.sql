-- Halvo — order bumps.
--
-- A bump is a one-click add-on offered at checkout: "add X for $9". It changes
-- the amount charged, so the price always comes from this table server-side and
-- is never accepted from the client.
--
-- Note on safety: a bump can only be *taken* if it was first *configured*, and
-- it can only be configured once this table exists. So there is no window in
-- which a buyer could be charged for a bump that the delivery side doesn't know
-- how to hand over.

create table public.product_bumps (
  id uuid primary key default gen_random_uuid(),
  -- One bump per product: a checkout with a list of upsells stops converting.
  product_id uuid not null unique references public.products(id) on delete cascade,
  bump_product_id uuid not null references public.products(id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_bumps_no_self check (product_id <> bump_product_id)
);

alter table public.product_bumps enable row level security;

create trigger product_bumps_updated_at
  before update on public.product_bumps
  for each row execute function public.update_updated_at_column();

create policy "Owners can manage their own bumps"
  on public.product_bumps for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- The offer itself has to be readable by a signed-out buyer at checkout.
create policy "Bumps are publicly readable"
  on public.product_bumps for select
  using (true);

-- Which purchases actually took the bump. A separate table rather than a column
-- on transactions, so delivery can look it up defensively and the transaction
-- insert path stays exactly as it was.
create table public.transaction_bumps (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  bump_product_id uuid not null references public.products(id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.transaction_bumps enable row level security;

-- Written and read only through the service-role client during checkout and
-- delivery; no anon/authenticated policy at all.
