-- 0022 — account deactivation and deletion.
--
-- Two separate things, deliberately:
--
--   DEACTIVATE  reversible. One flag on the profile. Products stay exactly as
--               they are (slugs included, so nothing loses its URL or its
--               search ranking) but every public surface and every money path
--               treats the seller as absent. Buyers keep their downloads.
--
--   DELETE      permanent, and it removes the auth user so the erasure is
--               real rather than a flag. That cascade is what the second half
--               of this migration is about.

-- ---------------------------------------------------------------------------
-- Deactivation
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

-- Discover has to exclude deactivated sellers' products, which means reading
-- the set of deactivated ids on every call. Partial index so that read stays
-- proportional to the number of deactivated accounts, not the user table.
create index if not exists profiles_deactivated_idx
  on public.profiles(id)
  where deactivated_at is not null;

comment on column public.profiles.deactivated_at is
  'Set while the seller has deactivated. Hides their storefront and products '
  'and refuses new sales, reversibly. NULL means active.';

-- `select` on profiles is revoked wholesale in 0001 and re-granted column by
-- column, so a new column is unreadable and unwritable until it's named here.
-- Without these two grants the settings page fails with "permission denied for
-- column deactivated_at" rather than with anything that points at the cause.
--
-- Granted to `authenticated` only. The public read paths (storefront, product
-- page, discover, sitemap) all go through the service-role client, which isn't
-- subject to these grants — so `anon` has no reason to see it.
grant select (deactivated_at) on public.profiles to authenticated;
grant update (deactivated_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Keep what buyers paid for when the owner is deleted
-- ---------------------------------------------------------------------------
-- Two tables had `owner_id not null references auth.users on delete cascade`,
-- and in both cases that cascade is a trap. Deleting a seller's auth user
-- would delete the rows a BUYER's download is resolved through:
--
--   product_files   `entitlement.server.ts` reads these rows to hand over the
--                   files. Cascade them away and every past buyer of that
--                   seller silently loses the file they paid for.
--
--   bundle_items    `resolveDeliverableProductIds` expands a bundle through
--                   these rows. Cascade them away and a bundle still resolves
--                   -- to nothing but the bundle product itself, which usually
--                   has no files of its own. The buyer of a bundle loses the
--                   entire thing, which is the worse of the two.
--
-- So both now survive their owner, exactly the way `products.owner_id` and
-- `transactions.seller_id` already do. Nothing else needs to change:
--
--   * the only RLS policy on either table is `auth.uid() = owner_id`, and
--     `auth.uid() = null` evaluates to NULL, so an orphaned row is readable
--     by nobody. Neither table has an anon policy at all.
--   * downloads go through the service-role client after a verified purchase,
--     and never look at owner_id.
--   * the storage-limit maths filters `.eq("owner_id", <uid>)`, which an
--     orphaned row can never match -- so a deleted seller's bytes stop
--     counting against anyone, which is correct.

alter table public.product_files alter column owner_id drop not null;
alter table public.bundle_items  alter column owner_id drop not null;

do $$
declare
  target text;
  fk_name text;
begin
  foreach target in array array['product_files', 'bundle_items']
  loop
    -- Find the constraint by what it does rather than by its name, in case it
    -- was ever created or restored under a different one.
    select con.conname into fk_name
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = con.conkey[1]
    where con.conrelid = ('public.' || target)::regclass
      and con.contype = 'f'
      and array_length(con.conkey, 1) = 1
      and att.attname = 'owner_id';

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', target, fk_name);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (owner_id) '
      || 'references auth.users(id) on delete set null',
      target, target || '_owner_id_fkey'
    );
  end loop;
end $$;

comment on column public.product_files.owner_id is
  'NULL once the owning account is deleted. The row is kept on purpose so '
  'buyers who already paid keep their download; RLS then denies it to '
  'everyone and only the service role can read it.';

comment on column public.bundle_items.owner_id is
  'NULL once the owning account is deleted. Kept so a bundle a buyer already '
  'paid for still expands to its items.';
