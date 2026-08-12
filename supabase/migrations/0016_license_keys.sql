-- Halvo — license keys for software / licensed digital products.
--
-- Some products (software, plugins, fonts, presets, API access) need a unique
-- key per purchase that the seller's own app can verify. This adds an opt-in
-- per-product flag and a table of minted keys.
--
-- Keys are minted lazily and idempotently the first time the buyer opens their
-- download page (see getLicenseKeyForTransaction) — the money-recording path is
-- untouched. A key's validity is DERIVED from its transaction, so a refunded or
-- disputed purchase automatically invalidates its key with no extra bookkeeping.
--
-- Degrade-safe: without this migration, the flag reads as false and key minting
-- is a no-op, so nothing breaks.

alter table public.products add column if not exists license_key_enabled boolean not null default false;

create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  -- One key per purchase; the unique constraint is what makes minting idempotent.
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  license_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists license_keys_key_idx on public.license_keys(license_key);

alter table public.license_keys enable row level security;
-- Minted and validated only by the service-role server functions / API route,
-- so there is no anon/authenticated policy.
