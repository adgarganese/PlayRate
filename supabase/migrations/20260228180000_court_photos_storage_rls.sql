-- Court photos: storage RLS + table RLS; ownership aligned with court_photos.user_id.
-- Path convention: court-photos/{court_id}/{user_id}/{filename} so Storage can enforce owner-only update/delete.
-- 1) Create the bucket "court-photos" in Dashboard first (Storage > New bucket, name: court-photos, public optional).
-- 2) Table court_photos must exist (run court-photos-migration.sql if needed).
-- Note: Objects with legacy path {court_id}/{filename} (no user_id) remain readable but are not updatable/deletable via RLS.

-- ========== STORAGE: court-photos bucket ==========
-- (storage.foldername(name))[1] = court_id, [2] = user_id. Only owner (user_id = auth.uid()) may INSERT/UPDATE/DELETE.

DROP POLICY IF EXISTS "court_photos_storage_insert" ON storage.objects;
CREATE POLICY "court_photos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'court-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "court_photos_storage_select" ON storage.objects;
CREATE POLICY "court_photos_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'court-photos');

DROP POLICY IF EXISTS "court_photos_storage_update" ON storage.objects;
CREATE POLICY "court_photos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'court-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "court_photos_storage_delete" ON storage.objects;
CREATE POLICY "court_photos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'court-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ========== TABLE: court_photos RLS (idempotent; table must exist) ==========
-- Ensures INSERT/UPDATE allow current user only so upsert after upload succeeds.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'court_photos') THEN
    ALTER TABLE public.court_photos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can read court photos" ON public.court_photos;
    CREATE POLICY "Anyone can read court photos" ON public.court_photos
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Users can insert their own court photos" ON public.court_photos;
    CREATE POLICY "Users can insert their own court photos" ON public.court_photos
      FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update their own court photos" ON public.court_photos;
    CREATE POLICY "Users can update their own court photos" ON public.court_photos
      FOR UPDATE USING ((SELECT auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete their own court photos" ON public.court_photos;
    CREATE POLICY "Users can delete their own court photos" ON public.court_photos
      FOR DELETE USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
