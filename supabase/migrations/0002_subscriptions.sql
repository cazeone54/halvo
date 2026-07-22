-- Halvo — Phase 2 schema: subscriptions is the single source of truth for
-- plan tier. Deliberately no `profiles.tier` column — Kitsly had two
-- divergent tier models (a `profiles.tier` enum written by the webhook with
-- exact-match price IDs, and a separately-computed tier from `subscriptions`
-- using substring matching) that could disagree with each other. Here there
-- is only ever one place tier is computed from.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_customer_id text not null,
  price_id text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

-- Read-only for the owning user; all writes go through the service-role
-- client from the Stripe webhook — never trust a client-reported sub status.
create policy "Owners can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);
