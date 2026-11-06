-- Halvo — rows that point at products must point at the seller's OWN products.
--
-- product_files, bundle_items, product_bumps and coupons were each guarded only
-- by "this row's owner_id is you". Nothing checked what the row points AT, so a
-- signed-in seller writing straight to the API (not through the app) could:
--   * attach their own file to another seller's product (product_files),
--   * bundle another seller's paid product into their own free product
--     (bundle_items), or
--   * put an add-on on another seller's checkout (product_bumps).
-- The app's server now re-checks ownership wherever these rows are read
-- (owned-storage.ts); this closes the door where they're written.
--
-- Safe to run more than once. Reading is unchanged; only inserts and updates
-- are tightened. A check on 2026-11-07 found no existing rows that break these
-- rules, so nothing already saved is affected.

-- Is this product the signed-in seller's?
create or replace function public.owns_product(p_product_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (select 1 from public.products where id = p_product_id and owner_id = auth.uid());
$$;

-- Files: on your own product, stored in your own folder.
drop policy if exists "Owners can manage their own product files" on public.product_files;
drop policy if exists "Owners manage files on their own products" on public.product_files;
create policy "Owners manage files on their own products"
  on public.product_files for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and public.owns_product(product_id)
    and storage_file_path like auth.uid()::text || '/%'
    -- no ".." path segment (a ".." inside a file name like "v2..final.pdf" is fine)
    and storage_file_path !~ '(^|/)\.\.(/|$)'
  );

-- Bundles: both the bundle and what goes in it are yours.
drop policy if exists "Owners can manage their own bundle items" on public.bundle_items;
drop policy if exists "Owners bundle only their own products" on public.bundle_items;
create policy "Owners bundle only their own products"
  on public.bundle_items for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and public.owns_product(bundle_product_id)
    and public.owns_product(item_product_id)
  );

-- Order bumps: both the product offering it and the add-on are yours.
drop policy if exists "Owners can manage their own bumps" on public.product_bumps;
drop policy if exists "Owners offer only their own bumps" on public.product_bumps;
create policy "Owners offer only their own bumps"
  on public.product_bumps for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and public.owns_product(product_id)
    and public.owns_product(bump_product_id)
  );

-- Coupons: shop-wide, or for one of your own products.
drop policy if exists "Owners can manage their own coupons" on public.coupons;
drop policy if exists "Owners discount only their own products" on public.coupons;
create policy "Owners discount only their own products"
  on public.coupons for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (product_id is null or public.owns_product(product_id))
  );
