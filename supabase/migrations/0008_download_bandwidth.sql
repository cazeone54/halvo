-- Halvo — download bandwidth tracking (margin protection).
--
-- Storage-at-rest is cheap; the real cost of digital delivery is egress —
-- bytes transferred on every download, which scales with a seller's success,
-- not their storage. To make that visible (and drive upgrades) without ever
-- blocking a buyer who already paid, each download access now records the
-- bytes it represents and the seller it belongs to, so we can sum a seller's
-- monthly bandwidth efficiently.

-- Estimated bytes served by this access (the total size of the product's
-- files — we can't see which the buyer actually pulled from the signed URL,
-- so we count the whole product, an honest upper bound). seller_id is
-- denormalized from the transaction so monthly usage is a single indexed sum.
alter table public.download_events add column bytes bigint not null default 0;
alter table public.download_events add column seller_id uuid references auth.users(id) on delete set null;

create index download_events_seller_month_idx on public.download_events(seller_id, created_at);
