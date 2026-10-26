-- Halvo — the storefront as a link-in-bio page.
--
-- A creator puts one link in their Instagram bio. This lets that link be their
-- Halvo page: their social profiles, up to six links of their own, and up to
-- three products pinned to the top — with a count of how often each link is
-- clicked, so they can see what their followers actually tap.
--
-- Additive only: three columns with empty defaults and one new table. Nothing
-- existing changes, and the app treats a missing column as "no links yet".

alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists bio_links jsonb not null default '[]'::jsonb,
  add column if not exists featured_product_ids uuid[] not null default '{}';

-- The app enforces these too; the database is the backstop if anything ever
-- writes around it.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_links_shape') then
    alter table public.profiles add constraint profiles_bio_links_shape
      check (jsonb_typeof(bio_links) = 'array' and jsonb_array_length(bio_links) <= 6);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_social_links_shape') then
    alter table public.profiles add constraint profiles_social_links_shape
      check (jsonb_typeof(social_links) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_featured_max') then
    alter table public.profiles add constraint profiles_featured_max
      check (cardinality(featured_product_ids) <= 3);
  end if;
end $$;

-- 0001_init revokes select on profiles and re-grants column by column, so a
-- new column is unreadable and unwritable until it is granted here. The owner
-- reads and saves their own links; the public page reads them with the
-- service role, so anon needs nothing.
grant select (social_links, bio_links, featured_product_ids) on public.profiles to authenticated;
grant update (social_links, bio_links, featured_product_ids) on public.profiles to authenticated;

-- One row per click on a seller's link. Written only by the server (service
-- role) from the /go/ redirect; a seller reads only their own.
create table if not exists public.link_clicks (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  link_id text not null,
  created_at timestamptz not null default now()
);

alter table public.link_clicks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'link_clicks' and policyname = 'Owners can read their link clicks'
  ) then
    create policy "Owners can read their link clicks"
      on public.link_clicks for select
      using (auth.uid() = profile_id);
  end if;
end $$;

-- Counting one link's clicks, all time and the last 30 days.
create index if not exists link_clicks_profile_link_idx
  on public.link_clicks (profile_id, link_id, created_at);
