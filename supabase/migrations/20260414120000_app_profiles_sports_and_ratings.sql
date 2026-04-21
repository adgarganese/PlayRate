-- App baseline: profiles columns used by the client, sports catalog, profile sports,
-- sport_profiles, sport_attributes, self_ratings.
-- Safe on existing Supabase projects: only ALTER ... ADD COLUMN IF NOT EXISTS where profiles exists;
-- creates domain tables with IF NOT EXISTS + idempotent seeds.

-- ---------------------------------------------------------------------------
-- 1) profiles: ensure columns referenced by lib/ and app/ (PK remains whatever exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_sport_id uuid;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS play_style text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cosign_count integer NOT NULL DEFAULT 0;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) sports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sports_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_sports_name_lower ON public.sports (lower(name));

-- ---------------------------------------------------------------------------
-- 3) sport_attributes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sport_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sport_attributes_sport_id ON public.sport_attributes(sport_id);

-- ---------------------------------------------------------------------------
-- 4) profile_sports (user plays these sports)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_sports (
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_sports_profile_id ON public.profile_sports(profile_id);

-- ---------------------------------------------------------------------------
-- 5) sport_profiles (per-sport play style etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sport_profiles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  play_style text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sport_id)
);

-- ---------------------------------------------------------------------------
-- 6) self_ratings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.self_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.sport_attributes(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 10),
  last_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_ratings_profile_attribute_unique UNIQUE (profile_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_self_ratings_profile_id ON public.self_ratings(profile_id);

CREATE OR REPLACE FUNCTION public.touch_self_rating_last_updated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_updated := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_self_ratings_touch_last_updated ON public.self_ratings;
CREATE TRIGGER tr_self_ratings_touch_last_updated
  BEFORE UPDATE ON public.self_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_self_rating_last_updated();

-- ---------------------------------------------------------------------------
-- 7) Seed sports + attributes (matches constants/sport-definitions.ts labels)
-- ---------------------------------------------------------------------------
INSERT INTO public.sports (name)
SELECT 'Basketball'
WHERE NOT EXISTS (SELECT 1 FROM public.sports WHERE lower(trim(name)) = 'basketball');

INSERT INTO public.sports (name)
SELECT 'Soccer'
WHERE NOT EXISTS (SELECT 1 FROM public.sports WHERE lower(trim(name)) = 'soccer');

INSERT INTO public.sport_attributes (sport_id, name)
SELECT s.id, v.name
FROM public.sports s
CROSS JOIN (VALUES
  ('Shooting'),
  ('Playmaking'),
  ('Rebounding'),
  ('Finishing'),
  ('Dribbling'),
  ('Perimeter Defense'),
  ('Post Defense'),
  ('Athleticism')
) AS v(name)
WHERE lower(trim(s.name)) = 'basketball'
  AND NOT EXISTS (
    SELECT 1 FROM public.sport_attributes sa
    WHERE sa.sport_id = s.id AND sa.name = v.name
  );

INSERT INTO public.sport_attributes (sport_id, name)
SELECT s.id, v.name
FROM public.sports s
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
) AS v(name)
WHERE lower(trim(s.name)) = 'soccer'
  AND NOT EXISTS (
    SELECT 1 FROM public.sport_attributes sa
    WHERE sa.sport_id = s.id AND sa.name = v.name
  );

-- ---------------------------------------------------------------------------
-- 8) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sports_select_authenticated" ON public.sports;
CREATE POLICY "sports_select_authenticated"
  ON public.sports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sport_attributes_select_authenticated" ON public.sport_attributes;
CREATE POLICY "sport_attributes_select_authenticated"
  ON public.sport_attributes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profile_sports_select_own" ON public.profile_sports;
CREATE POLICY "profile_sports_select_authenticated"
  ON public.profile_sports FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profile_sports_insert_own" ON public.profile_sports;
CREATE POLICY "profile_sports_insert_own"
  ON public.profile_sports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_sports_delete_own" ON public.profile_sports;
CREATE POLICY "profile_sports_delete_own"
  ON public.profile_sports FOR DELETE TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "sport_profiles_select_public" ON public.sport_profiles;
CREATE POLICY "sport_profiles_select_public"
  ON public.sport_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sport_profiles_insert_own" ON public.sport_profiles;
CREATE POLICY "sport_profiles_insert_own"
  ON public.sport_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sport_profiles_update_own" ON public.sport_profiles;
CREATE POLICY "sport_profiles_update_own"
  ON public.sport_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "self_ratings_select_own" ON public.self_ratings;
DROP POLICY IF EXISTS "self_ratings_select_public_for_profiles" ON public.self_ratings;
CREATE POLICY "self_ratings_select_authenticated"
  ON public.self_ratings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "self_ratings_insert_own" ON public.self_ratings;
CREATE POLICY "self_ratings_insert_own"
  ON public.self_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "self_ratings_update_own" ON public.self_ratings;
CREATE POLICY "self_ratings_update_own"
  ON public.self_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

GRANT SELECT, INSERT, DELETE ON public.profile_sports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sport_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.self_ratings TO authenticated;
GRANT SELECT ON public.sports TO authenticated;
GRANT SELECT ON public.sport_attributes TO authenticated;
