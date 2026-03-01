-- =========================================
-- SEED: Basketball sport + attributes
-- =========================================

-- 1) Create sport: Basketball
insert into sports (id, name)
values (gen_random_uuid(), 'Basketball')
on conflict (name) do nothing;

-- 2) Grab Basketball sport_id
with bb as (
  select id as sport_id
  from sports
  where name = 'Basketball'
  limit 1
)
-- 3) Insert attributes for Basketball
insert into sport_attributes (id, sport_id, name)
select gen_random_uuid(), bb.sport_id, a.name
from bb
cross join (values
  ('Shooting'),
  ('Playmaking'),
  ('Rebounding'),
  ('Finishing'),
  ('Dribbling'),
  ('Perimeter Defense'),
  ('Post Defense'),
  ('Athleticism')
) as a(name)
on conflict do nothing;

-- =========================================
-- OPTIONAL: Create a sample profile + self-ratings
-- Requires a real auth user_id UUID.
-- =========================================
-- Replace the UUID below with an existing auth.users.id
-- You can find it in Supabase Dashboard → Authentication → Users

-- DO THIS ONLY if your profiles table uses user_id as PK
-- and includes: name, username, bio, created_at
-- Adjust columns if your profiles table differs.

-- Example:
-- do $$
-- declare
--   v_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE
--   v_sport_id uuid;
-- begin
--   select id into v_sport_id from sports where name = 'Basketball' limit 1;
--
--   insert into profiles (user_id, name, username, bio, created_at)
--   values (v_user_id, 'Test Athlete', 'test_athlete', 'Basketball player.', now())
--   on conflict (user_id) do update
--     set name = excluded.name,
--         username = excluded.username,
--         bio = excluded.bio;
--
--   -- Seed self ratings (1–10). Adjust the numbers as desired.
--   insert into self_ratings (profile_id, attribute_id, rating, last_updated)
--   select
--     v_user_id as profile_id,
--     sa.id as attribute_id,
--     case sa.name
--       when 'Shooting' then 7
--       when 'Playmaking' then 6
--       when 'Rebounding' then 6
--       when 'Finishing' then 7
--       when 'Dribbling' then 6
--       when 'Perimeter Defense' then 5
--       when 'Post Defense' then 5
--       when 'Athleticism' then 7
--       else 5
--     end as rating,
--     now() as last_updated
--   from sport_attributes sa
--   where sa.sport_id = v_sport_id
--   on conflict (profile_id, attribute_id) do update
--     set rating = excluded.rating,
--         last_updated = excluded.last_updated;
-- end $$;

-- =========================================
-- Quick check queries
-- =========================================
-- select * from sports where name='Basketball';
-- select name from sport_attributes where sport_id = (select id from sports where name='Basketball') order by name;

