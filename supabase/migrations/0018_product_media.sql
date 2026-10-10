-- Halvo — product page media: a preview video and an image gallery.
--
-- preview_video_url: a YouTube, Vimeo or Loom link. The app validates it and
--   builds the embed URL itself, so only those players can ever be framed.
-- gallery_paths: up to 6 storage paths (in the seller's own folder) for extra
--   product images, served through /img/gallery/... like the cover image.
--
-- The app degrades safely without this migration: product pages simply show
-- the cover image, and the media editor explains that this needs applying.

alter table public.products add column if not exists preview_video_url text;
alter table public.products add column if not exists gallery_paths text[] not null default '{}';

alter table public.products drop constraint if exists products_gallery_paths_max;
alter table public.products
  add constraint products_gallery_paths_max check (coalesce(array_length(gallery_paths, 1), 0) <= 6);

alter table public.products drop constraint if exists products_preview_video_url_len;
alter table public.products
  add constraint products_preview_video_url_len check (preview_video_url is null or length(preview_video_url) <= 500);
