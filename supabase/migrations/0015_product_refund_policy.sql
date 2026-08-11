-- Halvo — optional per-product refund policy.
--
-- Sellers already have one account-wide refund policy (profiles.refund_policy),
-- shown on every product page. This adds an OPTIONAL per-product override for
-- sellers whose products warrant different terms (a €99 course vs a €5 template).
-- When set, it takes precedence on that product's page; when blank, the page
-- falls back to the account-wide policy.
--
-- The app is written to degrade safely without this column: writes are
-- best-effort (a missing column is ignored) and reads fall back, so product
-- create/edit and product pages keep working until this is applied.

alter table public.products add column if not exists refund_policy text;
