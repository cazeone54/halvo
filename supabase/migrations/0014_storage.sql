-- Halvo — storage bucket + policies, captured in version control.
--
-- The `digital-assets` bucket and its policies were originally created in the
-- Supabase dashboard, so they lived nowhere in the repo. This migration makes
-- them reproducible and reviewable. It is idempotent — safe to run against the
-- existing project; it will just re-assert the intended configuration.
--
-- Model: ONE private bucket holds every seller's deliverable files, cover
-- images and avatars, each under a `{user_id}/…` path prefix. Buyers never read
-- the bucket directly — downloads are always short-lived signed URLs minted
-- server-side (service role) after a purchase is verified (see
-- downloads.functions.ts). So authenticated users only ever need to manage
-- objects under their OWN prefix; nobody gets public read.

insert into storage.buckets (id, name, public)
values ('digital-assets', 'digital-assets', false)
on conflict (id) do update set public = false;

-- A user may only create/read/update/delete objects whose first path segment
-- is their own auth uid. This is what stops one seller writing into (or over)
-- another seller's files. Downloads bypass this via the service-role client.
drop policy if exists "Users manage their own digital assets" on storage.objects;
create policy "Users manage their own digital assets"
  on storage.objects for all to authenticated
  using (bucket_id = 'digital-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'digital-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- NOTE: if the dashboard created an earlier, broader storage policy on this
-- bucket (e.g. an "allow all authenticated" insert), drop it in the dashboard —
-- RLS policies are OR-ed, so a leftover permissive policy would undo the
-- prefix scoping above. This migration can't see policies it didn't create.
