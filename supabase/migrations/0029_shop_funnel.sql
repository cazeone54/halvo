-- Halvo — the shop page as a funnel: free download → follow-up emails → first
-- purchase → an offer straight after it, with a count of each step.
--
-- Additive only: three nullable columns on profiles and three new tables.
-- Nothing existing changes, and the app treats anything missing as "off".

-- The seller's "Start here" free product at the top of their page, and the one
-- product (with an optional discount code) offered on the download page.
alter table public.profiles
  add column if not exists start_here_product_id uuid references public.products(id) on delete set null,
  add column if not exists offer_product_id uuid references public.products(id) on delete set null,
  add column if not exists offer_coupon_code text;

-- 0001_init grants profiles column by column; new columns need their own.
grant select (start_here_product_id, offer_product_id, offer_coupon_code) on public.profiles to authenticated;
grant update (start_here_product_id, offer_product_id, offer_coupon_code) on public.profiles to authenticated;

-- One follow-up sequence per seller: email 2 two days after a free download,
-- email 3 (pointing at one paid product) five days after. Off until the seller
-- switches it on, and only ever sent to downloads made after that moment.
create table if not exists public.email_sequences (
  seller_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  step2_subject text not null default '',
  step2_body text not null default '',
  step3_subject text not null default '',
  step3_body text not null default '',
  step3_product_id uuid references public.products(id) on delete set null,
  step3_coupon_code text,
  updated_at timestamptz not null default now(),
  constraint email_sequences_lengths check (
    char_length(step2_subject) <= 150 and char_length(step3_subject) <= 150
    and char_length(step2_body) <= 5000 and char_length(step3_body) <= 5000
  )
);

alter table public.email_sequences enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'email_sequences' and policyname = 'Owners read their sequence') then
    create policy "Owners read their sequence" on public.email_sequences for select using (auth.uid() = seller_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'email_sequences' and policyname = 'Owners create their sequence') then
    create policy "Owners create their sequence" on public.email_sequences for insert with check (auth.uid() = seller_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'email_sequences' and policyname = 'Owners change their sequence') then
    create policy "Owners change their sequence" on public.email_sequences for update
      using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
  end if;
end $$;

-- Which follow-up went to which download. The unique pair is what stops an
-- email ever going twice: the sender claims the row before it sends.
create table if not exists public.sequence_sends (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  step smallint not null check (step in (2, 3)),
  sent_at timestamptz not null default now(),
  unique (transaction_id, step)
);

alter table public.sequence_sends enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sequence_sends' and policyname = 'Owners read their sends') then
    create policy "Owners read their sends" on public.sequence_sends for select using (auth.uid() = seller_id);
  end if;
end $$;

create index if not exists sequence_sends_seller_idx on public.sequence_sends (seller_id, sent_at);

-- One row per visit to a seller's page, with where the visitor came from —
-- the top of the funnel. Written only by the server.
create table if not exists public.shop_views (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  source text,
  created_at timestamptz not null default now()
);

alter table public.shop_views enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shop_views' and policyname = 'Owners read their shop views') then
    create policy "Owners read their shop views" on public.shop_views for select using (auth.uid() = seller_id);
  end if;
end $$;

create index if not exists shop_views_seller_idx on public.shop_views (seller_id, created_at);
