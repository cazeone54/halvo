-- Halvo — whether a seller's connected Stripe account can take payments.
--
-- Public pages hide a seller's paid products until this is true (and leave
-- unverified sellers out of Discover and the sitemap entirely), so a product
-- nobody can buy is never shown to buyers. See seller-visibility.server.ts.
--
-- Kept in step by the server: the dashboard's Stripe status check and the
-- account.updated webhook both write it, using the service role.

alter table public.profiles
  add column if not exists stripe_charges_enabled boolean not null default false;

-- Sellers already connected today are assumed able to take payments; the
-- server re-checks with Stripe the next time each one opens their dashboard.
update public.profiles
set stripe_charges_enabled = true
where stripe_connect_id is not null;

-- Profiles are editable by their owner (settings), so without this a seller
-- could set the flag on their own row through the API and list products that
-- can't be bought. Only the service role (the server) and database admins may
-- change it; anyone else's write keeps the old value instead of failing, so a
-- settings save that happens to include the column still goes through.
create or replace function public.protect_stripe_charges_enabled()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.stripe_charges_enabled := false;
    else
      new.stripe_charges_enabled := old.stripe_charges_enabled;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_stripe_charges_enabled on public.profiles;
create trigger protect_stripe_charges_enabled
  before insert or update on public.profiles
  for each row execute function public.protect_stripe_charges_enabled();

-- Listings read the small set of sellers who can take payments.
create index if not exists profiles_stripe_charges_enabled_idx
  on public.profiles (id)
  where stripe_charges_enabled;
