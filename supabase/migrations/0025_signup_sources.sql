-- Halvo — where each new seller account came from.
--
-- One row per account, written once by the server right after sign-up (see
-- signup-source.functions.ts): the normalised channel (instagram, meta,
-- google, Direct…), the ad campaign and ad from the link's UTM tags, and the
-- page they first landed on. This is what tells a paid campaign apart from
-- outreach and organic posts.
--
-- Private to the platform: RLS is on with no policies, so only the service
-- role can read or write it. Sellers' acquisition data is never exposed
-- through the public API.

create table if not exists public.signup_sources (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null,
  campaign text,
  content text,
  landing_path text,
  created_at timestamptz not null default now()
);

alter table public.signup_sources enable row level security;
revoke all on public.signup_sources from anon, authenticated;

create index if not exists signup_sources_created_at_idx on public.signup_sources (created_at desc);
