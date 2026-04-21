-- Published highlight media bucket (lib/highlight-drafts.ts HIGHLIGHTS_PUBLISH_BUCKET, create.tsx STORAGE_BUCKET_HIGHLIGHTS).

INSERT INTO storage.buckets (id, name, public)
VALUES ('highlights', 'highlights', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DROP POLICY IF EXISTS "storage_highlights_select_public" ON storage.objects;
CREATE POLICY "storage_highlights_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'highlights');

DROP POLICY IF EXISTS "storage_highlights_insert_own_prefix" ON storage.objects;
CREATE POLICY "storage_highlights_insert_own_prefix"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'highlights'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_highlights_update_own_prefix" ON storage.objects;
CREATE POLICY "storage_highlights_update_own_prefix"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'highlights'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_highlights_delete_own_prefix" ON storage.objects;
CREATE POLICY "storage_highlights_delete_own_prefix"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'highlights'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
