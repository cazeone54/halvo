-- Halvo — a link as the thing a buyer gets, instead of a file.
--
-- Plenty of digital products aren't files: a Notion or Canva template is a
-- share link, so is a Google Drive folder or a private video. A seller making
-- a Notion template on 6 Nov 2026 stopped at "upload a file" because there was
-- none to upload. One link per product, delivered exactly like a file: only
-- after a verified purchase, through halvo.io/d/<purchase>/<id>.
--
-- Its own table, not a column on products, on purpose: published products are
-- readable by anyone (policy "Published products are publicly viewable"), so
-- a column there would hand the paid link to every visitor. Like
-- product_files, this table has no public policy at all; buyers reach the link
-- only through the service role after their purchase is checked.
--
-- Safe to run more than once.

create table if not exists public.product_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  -- Survives its owner, like product_files (migration 0022): deleting a
  -- seller's account must not take away what their buyers already paid for.
  owner_id uuid references auth.users(id) on delete set null,
  url text not null check (char_length(url) <= 2000 and url ~* '^https?://'),
  label text check (label is null or char_length(label) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_links enable row level security;
revoke all on public.product_links from anon;

drop trigger if exists product_links_updated_at on public.product_links;
create trigger product_links_updated_at
  before update on public.product_links
  for each row execute function public.update_updated_at_column();

-- Sellers manage the link on their OWN products only (owns_product: 0031).
drop policy if exists "Owners manage links on their own products" on public.product_links;
create policy "Owners manage links on their own products"
  on public.product_links for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and public.owns_product(product_id));

grant select, insert, update, delete on public.product_links to authenticated;
