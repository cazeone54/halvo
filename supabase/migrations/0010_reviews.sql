-- Halvo — product reviews, restricted to verified purchasers.
--
-- A review is tied to a specific transaction, not just to a product, and the
-- unique constraint on transaction_id means one review per actual purchase.
-- There is deliberately no way to leave a review without having bought the
-- thing, so the product pages can never fill up with fabricated praise.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  buyer_email text not null,
  rating integer not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_product_idx on public.reviews(product_id, created_at desc);

alter table public.reviews enable row level security;

create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.update_updated_at_column();

-- Reviews are public content on the product page, but the reviewer's email is
-- not. Same column-level grant discipline as profiles: the row is readable,
-- buyer_email is not exposed to clients at all.
create policy "Reviews are publicly readable"
  on public.reviews for select
  using (true);

revoke select on public.reviews from anon, authenticated;
grant select (id, product_id, rating, body, created_at) on public.reviews to anon, authenticated;

-- Writes only ever happen through the service-role client in the submitReview
-- server function, which re-verifies the purchase first. No INSERT/UPDATE
-- policy for anon or authenticated on purpose.
