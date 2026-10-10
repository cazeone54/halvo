-- Seller -> buyer email broadcasts.
--
-- broadcasts: one row per send, for the seller's own history and for the
-- rolling-24h send limit. Written before any email goes out, so a send that
-- fails part-way still counts against the limit (no retry-spam).
--
-- broadcast_unsubscribes: buyers who opted out of a given seller's
-- broadcasts. Written only by the server (service role) when a signed
-- unsubscribe link is used, so there is deliberately no insert policy for
-- authenticated users. Scoped per seller: unsubscribing from one seller's
-- updates never silences another seller, and never touches purchase
-- receipts or download links, which are transactional, not marketing.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 10000),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists broadcasts_seller_created_idx
  on public.broadcasts (seller_id, created_at desc);

alter table public.broadcasts enable row level security;

create policy "Sellers view their own broadcasts"
  on public.broadcasts for select
  using (auth.uid() = seller_id);

create policy "Sellers record their own broadcasts"
  on public.broadcasts for insert
  with check (auth.uid() = seller_id);

create table if not exists public.broadcast_unsubscribes (
  seller_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (seller_id, email)
);

alter table public.broadcast_unsubscribes enable row level security;

create policy "Sellers view who unsubscribed from them"
  on public.broadcast_unsubscribes for select
  using (auth.uid() = seller_id);
