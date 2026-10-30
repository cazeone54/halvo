-- Halvo — a shop page that looks like the seller's own: a banner picture across
-- the top, and a short announcement bar above everything ("New course out
-- Friday", "20% off this week").
--
-- Additive only: three nullable columns. Nothing existing changes, and the app
-- treats a missing column as "no banner, no announcement".

alter table public.profiles
  add column if not exists banner_path text,
  add column if not exists announcement_text text,
  add column if not exists announcement_url text;

-- The app enforces these too; the database is the backstop if anything ever
-- writes around it.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_announcement_lengths') then
    alter table public.profiles add constraint profiles_announcement_lengths
      check (char_length(announcement_text) <= 140 and char_length(announcement_url) <= 500);
  end if;
end $$;

-- 0001_init grants profiles column by column; new columns need their own. The
-- public shop reads them with the service role, so anon needs nothing. The
-- banner route only ever signs a file from the seller's own banner folder, so
-- writing any other path here gets nothing.
grant select (banner_path, announcement_text, announcement_url) on public.profiles to authenticated;
grant update (banner_path, announcement_text, announcement_url) on public.profiles to authenticated;
