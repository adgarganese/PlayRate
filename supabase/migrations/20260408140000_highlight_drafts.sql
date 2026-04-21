-- Highlight drafts: persisted in-progress highlights (separate storage from published).
-- Run after auth.users exists.
--
-- If storage bucket creation below fails in your environment, create manually:
--   Dashboard → Storage → New bucket → id: highlights-drafts → Public: OFF (private).
--   Then apply the storage.objects policies from this file (or equivalent).

-- ========== TABLE ==========
CREATE TABLE IF NOT EXISTS public.highlight_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text,
  caption text,
  media_type text CHECK (media_type IS NULL OR media_type IN ('video', 'image')),
  media_url text,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.highlight_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own drafts" ON public.highlight_drafts;
CREATE POLICY "Users can view own drafts"
  ON public.highlight_drafts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own drafts" ON public.highlight_drafts;
CREATE POLICY "Users can create own drafts"
  ON public.highlight_drafts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own drafts" ON public.highlight_drafts;
CREATE POLICY "Users can update own drafts"
  ON public.highlight_drafts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own drafts" ON public.highlight_drafts;
CREATE POLICY "Users can delete own drafts"
  ON public.highlight_drafts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlight_drafts TO authenticated;

CREATE INDEX IF NOT EXISTS idx_highlight_drafts_user_id
  ON public.highlight_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_highlight_drafts_updated_at
  ON public.highlight_drafts(updated_at DESC);

-- ========== STORAGE: highlights-drafts (private) ==========
-- Object paths: {user_id}/{draft_id}/media.{ext} (and optional extra files in same folder).
INSERT INTO storage.buckets (id, name, public)
VALUES ('highlights-drafts', 'highlights-drafts', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DROP POLICY IF EXISTS "Users can read own highlight drafts" ON storage.objects;
CREATE POLICY "Users can read own highlight drafts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'highlights-drafts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own highlight drafts" ON storage.objects;
CREATE POLICY "Users can upload own highlight drafts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'highlights-drafts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own highlight drafts" ON storage.objects;
CREATE POLICY "Users can update own highlight drafts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'highlights-drafts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own highlight drafts" ON storage.objects;
CREATE POLICY "Users can delete own highlight drafts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'highlights-drafts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
