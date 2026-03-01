-- ============================================
-- COURT PHOTOS MIGRATION
-- Adds photo carousel support (up to 4 photos per court)
-- ============================================

-- Step 1: Create court_photos table
CREATE TABLE IF NOT EXISTS court_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 4),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(court_id, slot)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_court_photos_court_id ON court_photos(court_id);
CREATE INDEX IF NOT EXISTS idx_court_photos_user_id ON court_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_court_photos_court_slot ON court_photos(court_id, slot);

-- Step 3: Enable RLS
ALTER TABLE court_photos ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies
-- Anyone can read court photos (matching app pattern - public data)
DROP POLICY IF EXISTS "Anyone can read court photos" ON court_photos;
CREATE POLICY "Anyone can read court photos" ON court_photos 
  FOR SELECT USING (true);

-- Users can insert their own photos; (select auth.uid()) for per-statement evaluation
DROP POLICY IF EXISTS "Users can insert their own court photos" ON court_photos;
CREATE POLICY "Users can insert their own court photos" ON court_photos 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Users can update their own photos (allows replacing photos in slots)
DROP POLICY IF EXISTS "Users can update their own court photos" ON court_photos;
CREATE POLICY "Users can update their own court photos" ON court_photos 
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- Users can delete their own photos
DROP POLICY IF EXISTS "Users can delete their own court photos" ON court_photos;
CREATE POLICY "Users can delete their own court photos" ON court_photos 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Comments for documentation
COMMENT ON TABLE court_photos IS 'Court photos carousel (up to 4 photos per court, one per slot)';
COMMENT ON COLUMN court_photos.slot IS 'Photo slot number (1-4)';
COMMENT ON COLUMN court_photos.storage_path IS 'Path in Supabase Storage bucket court-photos';

-- ============================================
-- STORAGE BUCKET SETUP (Run in Supabase Dashboard)
-- ============================================
-- Note: You need to create the storage bucket manually in Supabase Dashboard:
-- 1. Go to Storage > Create Bucket
-- 2. Name: court-photos
-- 3. Public: Yes (or configure policies for public read)
-- 4. File size limit: 5MB (recommended)
-- 5. Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Storage Policies (if bucket is not public):
-- CREATE POLICY "Anyone can view court photos" ON storage.objects
--   FOR SELECT USING (bucket_id = 'court-photos');
--
-- CREATE POLICY "Authenticated users can upload court photos" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'court-photos' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Users can update their own court photos" ON storage.objects
--   FOR UPDATE USING (bucket_id = 'court-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users can delete their own court photos" ON storage.objects
--   FOR DELETE USING (bucket_id = 'court-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
