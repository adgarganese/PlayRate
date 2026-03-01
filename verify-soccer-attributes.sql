-- =========================================
-- VERIFY SOCCER ATTRIBUTES IN DATABASE
-- Run this in Supabase SQL Editor
-- =========================================

-- 1. Check if Soccer sport exists
SELECT id, name, created_at 
FROM sports 
WHERE name = 'Soccer';

-- 2. Check Soccer attributes (should show 10)
SELECT 
  sa.id,
  sa.name,
  sa.sport_id,
  s.name as sport_name
FROM sport_attributes sa
INNER JOIN sports s ON s.id = sa.sport_id
WHERE s.name = 'Soccer'
ORDER BY sa.name;

-- 3. Count Soccer attributes (should be 10)
SELECT COUNT(*) as attribute_count
FROM sport_attributes sa
INNER JOIN sports s ON s.id = sa.sport_id
WHERE s.name = 'Soccer';

-- 4. If attributes are missing, re-run the seed:
-- Copy and paste the contents of seed-soccer.sql and run it again
