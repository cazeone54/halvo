-- Halvo — bundles.
--
-- A bundle isn't a new kind of thing: it's an ordinary product that also
-- delivers the files of other products the seller already sells. That means it
-- reuses checkout, delivery, analytics and reviews untouched, rather than
-- introducing a parallel purchase path through the money code.

create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  item_product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One entry per pair, and a bundle can never contain itself.
  constraint bundle_items_unique unique (bundle_product_id, item_product_id),
  constraint bundle_items_no_self check (bundle_product_id <> item_product_id)
);

create index bundle_items_bundle_idx on public.bundle_items(bundle_product_id);

alter table public.bundle_items enable row level security;

-- Sellers manage bundles for their own products. Buyer-side delivery reads this
-- through the service-role client, which is also where the ownership of every
-- included product is re-checked.
create policy "Owners can manage their own bundle items"
  on public.bundle_items for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
