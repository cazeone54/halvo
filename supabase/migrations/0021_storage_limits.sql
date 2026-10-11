-- Halvo — hard per-file size limit on the storage bucket.
--
-- Uploads go straight from the browser to Storage, so the app's own checks
-- (upload-limits.ts) can be skipped by anyone calling the Storage API with
-- their login. This makes Supabase itself refuse any single file over 2 GB —
-- the largest file a verified seller is allowed — whoever uploads it.
--
-- Unattached uploads are removed by the daily sweep (/api/cron/storage-sweep).
--
-- Also check Supabase → Storage → Settings: the project-wide "Upload file size
-- limit" must be at least 2 GB, or real sellers' large files fail first.

update storage.buckets
set file_size_limit = 2147483648
where id = 'digital-assets';
