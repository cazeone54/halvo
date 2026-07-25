-- Halvo — product page views, for a conversion rate sellers can actually see.
--
-- Sellers could see sales but not how many people looked without buying, which
-- is the number that tells them whether the problem is traffic or the page.
-- Like sale_sources (0009), this is deliberately a separate table written
-- best-effort from the client after the page loads: if the write fails, or this
-- migration hasn't been applied yet, the storefront and checkout are completely
-- unaffected — the analytics page just shows no view data.
--
-- Only product_id + timestamp are stored. No IP, no buyer identity — this is a
-- privacy-light counter, not visitor tracking.

create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index product_views_product_idx on public.product_views(product_id);
create index product_views_created_idx on public.product_views(created_at);

alter table public.product_views enable row level security;

-- Inserted only by the service-role client (recordProductView), so there is no
-- anon/authenticated INSERT policy. A seller can read the views that belong to
-- their own products for the analytics page.
create policy "Sellers can view their own products' views"
  on public.product_views for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_views.product_id and p.owner_id = auth.uid()
    )
  );
