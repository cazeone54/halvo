-- 0023 — where a product VIEW came from, not just where a SALE came from.
--
-- 0009 already records a source per sale (`sale_sources`), so the dashboard can
-- say "3 sales came from instagram". On its own that's half a measurement: with
-- no source on views, a seller can see which channel produced sales but cannot
-- see which produced *traffic*, so conversion per channel is uncomputable. And
-- conversion per channel is the number that actually changes behaviour:
--
--     instagram   500 views ->  2 sales   (0.4%)
--     newsletter   40 views ->  9 sales   (22%)
--
-- Those two rows say "stop posting, start emailing". Sales-only data says
-- "instagram is your best channel", which is the opposite conclusion.
--
-- Stores the NORMALISED label only -- 'instagram', 'google', 'Direct' -- exactly
-- as sale_sources does, never the raw referrer URL. A channel name is not an
-- identifier and carries no consent obligation; a full referring URL can carry
-- query strings and private paths, so it is deliberately never persisted.

alter table public.product_views
  add column if not exists source text;

-- NULL for every view recorded before this migration, and for any visitor whose
-- browser sends no referrer and no utm_source where the normaliser isn't
-- reached. Reported as "Unknown" rather than silently folded into "Direct",
-- which would overstate direct traffic.
comment on column public.product_views.source is
  'Normalised traffic source for this view (instagram, google, Direct, ...), '
  'from normalizeTrafficSource(). NULL for views recorded before 0023. Never '
  'the raw referrer URL.';

-- The new access pattern is "group my own products' views by source", and RLS
-- scopes the read by product, so lead with product_id.
create index if not exists product_views_product_source_idx
  on public.product_views(product_id, source);
