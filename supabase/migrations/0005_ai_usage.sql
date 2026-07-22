-- Halvo — Phase 4 schema: AI copywriter usage tracking (one row per
-- generation call, so the monthly cap is a simple count query rather than a
-- mutable counter — same idempotency lesson learned from Phase 3's coupon
-- redemption counter).
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_generations_user_id_created_at_idx on public.ai_generations(user_id, created_at);

alter table public.ai_generations enable row level security;

create policy "Owners can view their own AI usage"
  on public.ai_generations for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy — only ever written by the service-role
-- client from the copywriter server function.
