-- View count dedupe: one count per user per highlight per 24h; anonymous not counted.
-- Run after 20260228160000_highlights_views_replies.sql.

-- Add user_id to highlight_views (nullable for existing rows and for ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'highlight_views' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.highlight_views
      ADD COLUMN user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast dedupe check: recent view by (highlight_id, user_id)
CREATE INDEX IF NOT EXISTS idx_highlight_views_highlight_user_recent
  ON public.highlight_views(highlight_id, user_id, viewed_at DESC)
  WHERE user_id IS NOT NULL;

-- RLS: only allow inserting a view with your own user_id (no anonymous inserts; no null user_id)
DROP POLICY IF EXISTS "highlight_views_insert_authenticated" ON public.highlight_views;
CREATE POLICY "highlight_views_insert_authenticated"
  ON public.highlight_views FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
