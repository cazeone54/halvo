-- Halvo — memberships (recurring) and split payments (installments).
--
-- products.billing_type: 'one_time' (default) or 'membership'.
-- products.billing_interval: 'month' | 'year' for memberships.
-- products.installment_count: 2-12 lets buyers of a one-time product choose to
--   pay in that many monthly payments instead of all at once.
-- products.stripe_product_id: the Stripe Product used for recurring prices.
--
-- buyer_subscriptions: one row per buyer membership / payment plan. Written
-- only by the server (service role) from verified Stripe data; sellers can
-- read their own. Every paid invoice is also a row in transactions (linked by
-- buyer_subscription_id), so revenue, customers and access keep working.
--
-- Without this migration nothing changes: products stay one-time and the
-- billing editor explains that this needs applying.

alter table public.products add column if not exists billing_type text not null default 'one_time';
alter table public.products add column if not exists billing_interval text;
alter table public.products add column if not exists installment_count integer;
alter table public.products add column if not exists stripe_product_id text;

alter table public.products drop constraint if exists products_billing_type_valid;
alter table public.products add constraint products_billing_type_valid
  check (billing_type in ('one_time', 'membership'));
alter table public.products drop constraint if exists products_billing_interval_valid;
alter table public.products add constraint products_billing_interval_valid
  check (billing_interval is null or billing_interval in ('month', 'year'));
alter table public.products drop constraint if exists products_installment_count_valid;
alter table public.products add constraint products_installment_count_valid
  check (installment_count is null or installment_count between 2 and 12);

create table if not exists public.buyer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  buyer_email text not null,
  buyer_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('membership', 'installments')),
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null,
  amount_cents integer not null,
  billing_interval text not null default 'month',
  installments_total integer,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  past_due_since timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buyer_subscriptions_seller_idx on public.buyer_subscriptions(seller_id);

alter table public.buyer_subscriptions enable row level security;

drop policy if exists "Sellers view their buyer subscriptions" on public.buyer_subscriptions;
create policy "Sellers view their buyer subscriptions"
  on public.buyer_subscriptions for select
  using (auth.uid() = seller_id);

drop trigger if exists buyer_subscriptions_updated_at on public.buyer_subscriptions;
create trigger buyer_subscriptions_updated_at
  before update on public.buyer_subscriptions
  for each row execute function public.update_updated_at_column();

alter table public.transactions add column if not exists buyer_subscription_id uuid
  references public.buyer_subscriptions(id) on delete set null;
-- Renewals and later installments are revenue, but not new sales — they're
-- excluded from stock limits and "already sold" counts.
alter table public.transactions add column if not exists is_renewal boolean not null default false;
create index if not exists transactions_buyer_subscription_idx on public.transactions(buyer_subscription_id);
