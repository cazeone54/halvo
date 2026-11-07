-- Halvo — only the server decides which Stripe account a seller is paid through.
--
-- profiles.stripe_connect_id could be changed by the signed-in seller (the app
-- used to save it with the seller's own session). Stripe account ids aren't
-- secret — every product page hands its seller's to the browser for checkout —
-- so a seller writing straight to the API could set their profile to ANOTHER
-- seller's account: their products would then be listed and sold through it
-- (with chargebacks from stolen cards landing on that seller), and Connect
-- links would be made for it.
--
-- The app now writes this column with the service role only
-- (stripe-connect.functions.ts). This makes the database ignore it from
-- anyone else, the same way 0024 guards stripe_charges_enabled.
--
-- Safe to run more than once. Run it only AFTER the app version that writes
-- the column with the service role is live — before that, new sellers'
-- Stripe connections wouldn't be saved.

create or replace function public.protect_stripe_connect_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.stripe_connect_id := null;
    else
      new.stripe_connect_id := old.stripe_connect_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_stripe_connect_id on public.profiles;
create trigger protect_stripe_connect_id
  before insert or update on public.profiles
  for each row execute function public.protect_stripe_connect_id();
