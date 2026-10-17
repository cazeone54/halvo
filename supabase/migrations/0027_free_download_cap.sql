-- Halvo — tell free deliveries apart from paid ones.
--
-- A paid download is funded by the fee on that sale. A free one earns nothing
-- and still costs bandwidth, which is what makes a platform like this worth
-- abusing as a file host. Flagging the event lets the server cap free
-- deliveries per seller per month (see free-download-cap.ts) while a paid
-- download is never blocked — blocking someone who paid just invites a
-- chargeback.
alter table public.download_events
  add column if not exists is_free boolean not null default false;

-- The cap reads only this month's free events for one seller.
create index if not exists download_events_free_month_idx
  on public.download_events (seller_id, created_at)
  where is_free;
