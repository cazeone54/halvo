-- Halvo — one-time reminder emails to sellers who stopped part-way
-- (seller-nudge.ts): Stripe started but not finished, a paid product hidden
-- because Stripe was never connected, or a live product nobody has opened.
--
-- One row per seller and kind, written by the server just BEFORE the email is
-- sent, so the same reminder can never go to anyone twice. Service role only:
-- RLS is on and there are no policies, so sellers can't read or write it.
--
-- Safe to run more than once.

create table if not exists public.seller_nudges (
  seller_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('stripe', 'share')),
  sent_at timestamptz not null default now(),
  primary key (seller_id, kind)
);

alter table public.seller_nudges enable row level security;
