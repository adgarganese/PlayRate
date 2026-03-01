-- ============================================
-- FIX: Add RLS policies for sports tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Sports policies (allow anyone to read)
DROP POLICY IF EXISTS "Anyone can read sports" ON sports;
CREATE POLICY "Anyone can read sports" ON sports FOR SELECT USING (true);

-- Sport attributes policies (allow anyone to read)
DROP POLICY IF EXISTS "Anyone can read sport attributes" ON sport_attributes;
CREATE POLICY "Anyone can read sport attributes" ON sport_attributes FOR SELECT USING (true);

