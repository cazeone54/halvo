-- Replace the mutable coupons.redemptions counter with a join table, the
-- same idempotency trick already used for commissions (a unique constraint
-- on transaction_id). The mutable counter could be double-incremented or
-- (as actually observed in testing) never incremented at all depending on
-- which of the two writers racing to insert a transaction row won —
-- deriving the count from a row-per-redemption table instead makes it
-- correct regardless of that race.

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index coupon_redemptions_coupon_id_idx on public.coupon_redemptions(coupon_id);

alter table public.coupon_redemptions enable row level security;

create policy "Owners can view redemptions of their own coupons"
  on public.coupon_redemptions for select
  using (
    exists (
      select 1 from public.coupons c
      where c.id = coupon_redemptions.coupon_id and c.owner_id = auth.uid()
    )
  );

-- No insert/update/delete policy — only ever written by the service-role
-- client during checkout.

alter table public.coupons drop column redemptions;
