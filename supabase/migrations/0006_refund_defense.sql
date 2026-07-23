-- Halvo — refund/chargeback defense for digital goods.
--
-- A digital product can't be "returned", so the only things that actually
-- protect a seller in a Stripe dispute are (1) proof the buyer explicitly
-- agreed the sale was final and instantly delivered, and (2) proof the buyer
-- actually accessed/downloaded the file. Neither was recorded before. This
-- migration adds both — the consent timestamp on the transaction, and a
-- per-access download log the seller can point to as evidence.

-- ---------------------------------------------------------------------------
-- transactions: buyer's explicit "sale is final" acknowledgment
-- ---------------------------------------------------------------------------
-- Null = not acknowledged (legacy rows, or the rare case the browser closed
-- before the client recorded it). A timestamp = the buyer ticked the
-- final-sale box before paying.
alter table public.transactions add column terms_acked_at timestamptz;

-- ---------------------------------------------------------------------------
-- download_events — one row per time a buyer pulls their download links
-- ---------------------------------------------------------------------------
create table public.download_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_file_id uuid references public.product_files(id) on delete set null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index download_events_transaction_id_idx on public.download_events(transaction_id);

alter table public.download_events enable row level security;

-- Writes only ever happen through the service-role client in the downloads
-- server function (no anon/authenticated INSERT policy). Sellers can read the
-- events for their own sales so the dashboard can show the evidence trail;
-- the subquery is itself gated by the transactions RLS policy, so a seller
-- only sees events tied to transactions they already own.
create policy "Sellers can view download events for their sales"
  on public.download_events for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = download_events.transaction_id
        and t.seller_id = auth.uid()
    )
  );
