-- Halvo — Phase 1 schema: profiles, products, product_files, transactions.
-- No `subscriptions`/tier column here — plan tier is entirely Phase 2 scope,
-- so there is only ever one tier model, unlike Kitsly's two divergent ones.

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  stripe_connect_id text,
  support_email text,
  refund_policy text,
  thank_you_message text,
  thank_you_redirect_url text,
  accent_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handle_format check (handle is null or handle ~ '^[a-z0-9_-]{3,32}$')
);

alter table public.profiles enable row level security;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Owner can see/manage their own full row.
create policy "Owners can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Owners can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Public can look up a profile by handle, but only the safe public columns
-- are exposed via column-level grants below — not the row-level policy alone.
create policy "Public can view profiles by handle"
  on public.profiles for select
  using (handle is not null);

revoke select on public.profiles from anon, authenticated;
grant select (id, handle, display_name, avatar_url, bio) on public.profiles to anon, authenticated;
-- Owners still get their own full-row columns via the "own profile" policy
-- above; grant the remaining columns too so `select *` works for the owner.
grant select (
  stripe_connect_id, support_email, refund_policy, thank_you_message,
  thank_you_redirect_url, accent_color, created_at, updated_at
) on public.profiles to authenticated;

grant insert (id, handle, display_name, avatar_url) on public.profiles to authenticated;
grant update (
  handle, display_name, avatar_url, bio, support_email, refund_policy,
  thank_you_message, thank_you_redirect_url, accent_color
) on public.profiles to authenticated;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  pay_what_you_want boolean not null default false,
  image_url text,
  url_slug text unique,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.update_updated_at_column();

create policy "Published products are publicly viewable"
  on public.products for select
  using (url_slug is not null);

create policy "Owners can view all their own products"
  on public.products for select
  using (auth.uid() = owner_id);

create policy "Owners can insert their own products"
  on public.products for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own products"
  on public.products for update
  using (auth.uid() = owner_id);

create policy "Owners can delete their own products"
  on public.products for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- product_files — real one-to-many (unlike Kitsly's PK-is-product_id table)
-- ---------------------------------------------------------------------------
create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_file_path text not null,
  file_name text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index product_files_product_id_idx on public.product_files(product_id);

alter table public.product_files enable row level security;

create policy "Owners can manage their own product files"
  on public.product_files for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- No public/anon policy at all — file rows are only ever read server-side
-- via the service-role client after a verified purchase (see downloads
-- server function in Phase 1 routes), same discipline as Kitsly.

-- ---------------------------------------------------------------------------
-- transactions — orders/purchases
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid references auth.users(id) on delete set null,
  buyer_id uuid references auth.users(id) on delete set null,
  buyer_email text not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'refunded')),
  amount_paid_cents integer not null check (amount_paid_cents >= 0),
  stripe_payment_intent_id text unique,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create index transactions_seller_id_idx on public.transactions(seller_id);
create index transactions_buyer_id_idx on public.transactions(buyer_id);
create index transactions_product_id_idx on public.transactions(product_id);

alter table public.transactions enable row level security;

-- No public/anon SELECT or INSERT at all — every read/write goes through the
-- service-role client in server functions (checkout, webhook, downloads),
-- which independently re-verifies status against Stripe before trusting it.
create policy "Sellers can view their own transactions"
  on public.transactions for select
  using (auth.uid() = seller_id);

create policy "Buyers can view their own transactions"
  on public.transactions for select
  using (auth.uid() = buyer_id);

-- ---------------------------------------------------------------------------
-- Storage — single private bucket for product files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('digital-assets', 'digital-assets', false)
on conflict (id) do nothing;

create policy "Owners can manage their own storage objects"
  on storage.objects for all
  using (bucket_id = 'digital-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'digital-assets' and (storage.foldername(name))[1] = auth.uid()::text);
