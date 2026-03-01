-- ============================================
-- COURT RATINGS MIGRATION
-- Adds court rating system (1-10 scale per user per court)
-- ============================================

-- Step 1: Create court_ratings table
CREATE TABLE IF NOT EXISTS court_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(court_id, user_id)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_court_ratings_court_id ON court_ratings(court_id);
CREATE INDEX IF NOT EXISTS idx_court_ratings_user_id ON court_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_court_ratings_court_user ON court_ratings(court_id, user_id);

-- Step 3: Enable RLS
ALTER TABLE court_ratings ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies
-- Anyone can read ratings (matching app pattern - public data)
DROP POLICY IF EXISTS "Anyone can read court ratings" ON court_ratings;
CREATE POLICY "Anyone can read court ratings" ON court_ratings 
  FOR SELECT USING (true);

-- Users can insert their own ratings; (select auth.uid()) for per-statement evaluation
DROP POLICY IF EXISTS "Users can insert their own court ratings" ON court_ratings;
CREATE POLICY "Users can insert their own court ratings" ON court_ratings 
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Users can update their own ratings
DROP POLICY IF EXISTS "Users can update their own court ratings" ON court_ratings;
CREATE POLICY "Users can update their own court ratings" ON court_ratings 
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- Users can delete their own ratings (optional, but useful)
DROP POLICY IF EXISTS "Users can delete their own court ratings" ON court_ratings;
CREATE POLICY "Users can delete their own court ratings" ON court_ratings 
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Step 5: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_court_rating_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Step 6: Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_court_rating_timestamp ON court_ratings;
CREATE TRIGGER trigger_update_court_rating_timestamp
  BEFORE UPDATE ON court_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_court_rating_updated_at();

-- Step 7: Create view for court rating aggregations (Approach B)
-- This view provides avg rating and count per court for efficient queries
-- SECURITY INVOKER: view runs with caller's privileges and respects RLS on court_ratings
CREATE OR REPLACE VIEW court_rating_stats WITH (security_invoker = true) AS
SELECT 
  court_id,
  COUNT(*) as rating_count,
  ROUND(AVG(rating)::numeric, 1) as average_rating
FROM court_ratings
GROUP BY court_id;

-- Step 8: Create RPC function to get rating stats + user's rating in one call
-- This is more efficient than multiple queries
CREATE OR REPLACE FUNCTION get_court_rating_info(
  court_id_param UUID,
  user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  average_rating NUMERIC,
  rating_count BIGINT,
  user_rating INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) as rating_count,
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::numeric, 1)
        ELSE 0::NUMERIC
      END as average_rating
    FROM court_ratings
    WHERE court_id = court_id_param
  ),
  user_rating_row AS (
    SELECT rating
    FROM court_ratings
    WHERE court_id = court_id_param
      AND user_id_param IS NOT NULL
      AND user_id = user_id_param
    LIMIT 1
  )
  SELECT 
    stats.average_rating,
    stats.rating_count,
    user_rating_row.rating as user_rating
  FROM stats
  LEFT JOIN user_rating_row ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Comments for documentation
COMMENT ON TABLE court_ratings IS 'User ratings for courts (1-10 scale, one rating per user per court)';
COMMENT ON COLUMN court_ratings.rating IS 'Rating value from 1 to 10';
COMMENT ON VIEW court_rating_stats IS 'Aggregated statistics (avg rating and count) per court';
COMMENT ON FUNCTION get_court_rating_info IS 'Get rating stats and user rating in one efficient call';
