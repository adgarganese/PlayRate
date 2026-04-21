-- Court photo uploads (lib/courts-api.ts: bucket `court-photos`, path `{court_id}/{user_id}/{filename}`).
-- Matches the pattern in 20260414120700_app_storage_highlights_bucket.sql: ensure bucket row exists, then storage.objects RLS.
-- Supersedes legacy policy names from 20260228180000_court_photos_storage_rls.sql so only one policy set applies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('court-photos', 'court-photos', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Remove legacy names (idempotent)
DROP POLICY IF EXISTS "court_photos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "court_photos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "court_photos_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "court_photos_storage_delete" ON storage.objects;

DROP POLICY IF EXISTS "storage_court_photos_select_public" ON storage.objects;
CREATE POLICY "storage_court_photos_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'court-photos');

-- Path segment [2] must be the uploader (auth.uid()); [1] is court_id (lib/courts-api.ts).
DROP POLICY IF EXISTS "storage_court_photos_insert_own_user_segment" ON storage.objects;
CREATE POLICY "storage_court_photos_insert_own_user_segment"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'court-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_court_photos_update_own_user_segment" ON storage.objects;
CREATE POLICY "storage_court_photos_update_own_user_segment"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'court-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_court_photos_delete_own_user_segment" ON storage.objects;
CREATE POLICY "storage_court_photos_delete_own_user_segment"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'court-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
