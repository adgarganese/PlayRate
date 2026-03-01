-- =========================================
-- SEED: Soccer sport + attributes
-- =========================================

-- 1) Create sport: Soccer
INSERT INTO sports (id, name)
VALUES (gen_random_uuid(), 'Soccer')
ON CONFLICT (name) DO NOTHING;

-- 2) Grab Soccer sport_id
WITH soccer AS (
  SELECT id as sport_id
  FROM sports
  WHERE name = 'Soccer'
  LIMIT 1
)
-- 3) Insert attributes for Soccer (in exact order specified)
INSERT INTO sport_attributes (id, sport_id, name)
SELECT gen_random_uuid(), soccer.sport_id, a.name
FROM soccer
CROSS JOIN (VALUES
  ('Athleticism'),
  ('Speed / Acceleration'),
  ('Stamina / Work Rate'),
  ('Ball Control'),
  ('First Touch'),
  ('Dribbling'),
  ('Passing'),
  ('Vision'),
  ('Shooting / Finishing'),
  ('Defending')
) AS a(name)
ON CONFLICT DO NOTHING;

-- =========================================
-- Quick check queries
-- =========================================
-- SELECT * FROM sports WHERE name='Soccer';
-- SELECT name FROM sport_attributes WHERE sport_id = (SELECT id FROM sports WHERE name='Soccer') ORDER BY name;
