-- ============================================
-- FIX: Add RLS policies for court_sports table
-- Run this in Supabase SQL Editor
-- ============================================

-- Court sports policies
-- Allow anyone to read court_sports (needed to display sports on courts)
DROP POLICY IF EXISTS "Anyone can read court sports" ON court_sports;
CREATE POLICY "Anyone can read court sports" ON court_sports FOR SELECT USING (true);

-- Allow users to insert court_sports for courts they created
-- (select auth.uid()) evaluated once per statement for better performance
DROP POLICY IF EXISTS "Users can insert court sports for their courts" ON court_sports;
CREATE POLICY "Users can insert court sports for their courts" ON court_sports 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courts 
      WHERE courts.id = court_sports.court_id 
      AND courts.created_by = (select auth.uid())
    )
  );

