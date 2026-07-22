-- Halvo — Phase 3 schema: coupons, referral codes, commissions.
-- Deliberately no public/anon SELECT policy on referral_codes at all — Kitsly
-- dropped its RLS policy for this and relied on a bare anon GRANT SELECT
-- instead, which still let anyone enumerate every referral code in the
-- table. Here, code resolution at checkout time only ever happens
-- server-side through the service-role client, never through a client-
-- reachable policy or grant.

create type public.referral_kind as enum ('platform', 'product');

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade, -- null = store-wide
  code text not null,
  percent_off integer check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  amount_off_cents integer check (amount_off_cents is null or amount_off_cents > 0),
  max_redemptions integer,
  redemptions integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_owner_code_unique unique (owner_id, code),
  constraint coupons_discount_xor check (
    (percent_off is not null and amount_off_cents is null) or
    (percent_off is null and amount_off_cents is not null)
  )
);

alter table public.coupons enable row level security;

create trigger coupons_updated_at
  before update on public.coupons
  for each row execute function public.update_updated_at_column();

create policy "Owners can manage their own coupons"
  on public.coupons for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- No public/anon policy — coupon validation at checkout goes only through
-- the service-role client (see src/lib/coupons.functions.ts).

-- ---------------------------------------------------------------------------
-- referral_codes
-- ---------------------------------------------------------------------------
create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  kind public.referral_kind not null,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint referral_codes_product_required check (
    (kind = 'product' and product_id is not null) or (kind = 'platform' and product_id is null)
  )
);

-- Partial unique indexes (not a single UNIQUE constraint) because Postgres
-- treats NULLs as distinct — a plain unique constraint on (user_id, kind,
-- product_id) would let a user create unlimited platform codes since
-- product_id is null for all of them.
create unique index referral_codes_platform_unique on public.referral_codes(user_id) where kind = 'platform';
create unique index referral_codes_product_unique on public.referral_codes(user_id, product_id) where kind = 'product';

alter table public.referral_codes enable row level security;

create policy "Owners can view their own referral codes"
  on public.referral_codes for select
  using (auth.uid() = user_id);

create policy "Owners can create their own referral codes"
  on public.referral_codes for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- commissions
-- ---------------------------------------------------------------------------
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  kind public.referral_kind not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create index commissions_referrer_user_id_idx on public.commissions(referrer_user_id);

alter table public.commissions enable row level security;

create policy "Referrers can view their own commissions"
  on public.commissions for select
  using (auth.uid() = referrer_user_id);

-- ---------------------------------------------------------------------------
-- transactions: track which coupon (if any) was applied
-- ---------------------------------------------------------------------------
alter table public.transactions add column coupon_code text;
