-- Apply on Supabase. This bucket is accessed only by server-authorized signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-media','task-media',false,52428800,
 ARRAY['image/png','image/jpeg','image/webp','video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET public = false,
 file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
