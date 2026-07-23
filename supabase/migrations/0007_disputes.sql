-- Halvo — chargeback (dispute) liability shift.
--
-- Before this, a Stripe dispute on a destination charge was borne entirely by
-- the platform: Stripe debits the platform for the disputed amount + the
-- dispute fee, while the seller keeps their payout. That's backwards — the
-- seller made the sale, so the seller should bear a lost dispute. This adds the
-- bookkeeping the webhook needs to (a) record every dispute idempotently and
-- (b) claw the seller's payout back via a transfer reversal when a dispute is
-- actually lost.

-- ---------------------------------------------------------------------------
-- transactions: mark a purchase as under (or resolved from) dispute
-- ---------------------------------------------------------------------------
-- Set when a dispute opens (revokes download access + shows in the dashboard),
-- cleared if the seller wins. A lost dispute leaves it set.
alter table public.transactions add column disputed_at timestamptz;

-- ---------------------------------------------------------------------------
-- disputes — one row per Stripe dispute, idempotent on the Stripe dispute id
-- ---------------------------------------------------------------------------
-- The unique constraint on stripe_dispute_id is the idempotency guard: dispute
-- webhooks retry and fire multiple lifecycle events, and the transfer must only
-- ever be reversed once. Same discipline as coupon_redemptions/commissions —
-- a unique constraint, not a mutable flag that a race could double-process.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete set null,
  stripe_dispute_id text not null unique,
  amount_cents integer not null default 0,
  reason text,
  status text not null,
  transfer_reversed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index disputes_transaction_id_idx on public.disputes(transaction_id);

alter table public.disputes enable row level security;

create trigger disputes_updated_at
  before update on public.disputes
  for each row execute function public.update_updated_at_column();

-- Writes only ever happen through the service-role client in the Stripe webhook
-- (no anon/authenticated INSERT policy). Sellers can read the disputes tied to
-- their own sales so the dashboard can show them; the subquery is itself gated
-- by the transactions RLS policy, so a seller only sees their own.
create policy "Sellers can view disputes for their sales"
  on public.disputes for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = disputes.transaction_id
        and t.seller_id = auth.uid()
    )
  );
