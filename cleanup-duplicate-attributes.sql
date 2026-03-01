-- ============================================
-- CLEANUP: Remove duplicate sport attributes
-- Run this in Supabase SQL Editor
-- ============================================

-- Find and remove duplicate attributes for Basketball
-- This keeps only one of each attribute name per sport

WITH duplicates AS (
  SELECT 
    id,
    sport_id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY sport_id, name 
      ORDER BY created_at
    ) as row_num
  FROM sport_attributes
  WHERE sport_id = (SELECT id FROM sports WHERE name = 'Basketball' LIMIT 1)
)
DELETE FROM sport_attributes
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Verify the cleanup
SELECT 
  sa.name,
  COUNT(*) as count
FROM sport_attributes sa
JOIN sports s ON sa.sport_id = s.id
WHERE s.name = 'Basketball'
GROUP BY sa.name
HAVING COUNT(*) > 1;

-- If the above query returns no rows, duplicates are cleaned up
-- Each attribute should appear only once

