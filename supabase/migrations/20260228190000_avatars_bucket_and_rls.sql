-- Avatars bucket + Storage RLS so profile picture upload works.
-- App path: avatars/{user_id}/{timestamp}.ext — RLS restricts upload/update/delete to own path.

-- ========== 1. Create avatars bucket (if not exists) ==========
-- If this fails (e.g. "column public does not exist"), create the bucket manually in Dashboard:
-- Storage > New bucket > Name: avatars, Public: true.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- ========== 2. Storage RLS: avatars bucket ==========
-- (storage.foldername(name))[1] = user_id segment. Only owner can INSERT/UPDATE/DELETE.

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: allow anyone so avatar URLs work in feeds, profile views, DMs (with or without auth)
DROP POLICY IF EXISTS "Authenticated can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- ========== 3. profiles.avatar_url (if missing) ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
COMMENT ON COLUMN public.profiles.avatar_url IS 'Profile picture URL in Storage bucket avatars';
