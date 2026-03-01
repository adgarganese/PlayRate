-- ============================================
-- CHECK-IN SYSTEM MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create check_ins table
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_court_id_created_at ON public.check_ins(court_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_court_id_user_id_created_at ON public.check_ins(court_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON public.check_ins(user_id);

-- Step 3: Enable RLS
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies
-- Allow authenticated users to read all check-ins
CREATE POLICY "Anyone can read check_ins" ON public.check_ins
  FOR SELECT
  USING (true);

-- Prevent direct inserts (users must use RPC function)
-- This ensures anti-spam rules are enforced
CREATE POLICY "Prevent direct inserts" ON public.check_ins
  FOR INSERT
  WITH CHECK (false);

-- Allow users to delete their own check-ins (optional for future use)
CREATE POLICY "Users can delete own check_ins" ON public.check_ins
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 5: Create RPC function for check-in with anti-spam
CREATE OR REPLACE FUNCTION public.check_in(court_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_last_check_in TIMESTAMPTZ;
  v_today_start TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You must be signed in to check in.'
    );
  END IF;
  
  -- Verify court exists
  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE id = court_id_param) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Court not found.'
    );
  END IF;
  
  -- Calculate start of today (midnight UTC)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC');
  
  -- Check if user already checked in today (within last 24 hours OR calendar day)
  SELECT MAX(created_at)
  INTO v_last_check_in
  FROM public.check_ins
  WHERE user_id = v_user_id
    AND court_id = court_id_param
    AND created_at >= v_today_start;
  
  -- If user already checked in today, return error
  IF v_last_check_in IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You already checked in today.',
      'last_check_in', v_last_check_in
    );
  END IF;
  
  -- Insert new check-in
  INSERT INTO public.check_ins (court_id, user_id, created_at)
  VALUES (court_id_param, v_user_id, NOW());
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Checked in!',
    'check_in_id', (SELECT id FROM public.check_ins WHERE court_id = court_id_param AND user_id = v_user_id ORDER BY created_at DESC LIMIT 1)
  );
  
EXCEPTION
  WHEN others THEN
    RETURN json_build_object(
      'success', false,
      'message', 'An error occurred: ' || SQLERRM
    );
END;
$$;

-- Step 6: Grant execute permission on RPC function to authenticated users
GRANT EXECUTE ON FUNCTION public.check_in(UUID) TO authenticated;

-- Step 7: Create view for leaderboard (per court, all-time)
CREATE OR REPLACE VIEW public.court_leaderboard AS
SELECT 
  ci.court_id,
  ci.user_id,
  COUNT(*) as total_check_ins,
  MAX(ci.created_at) as last_check_in,
  ROW_NUMBER() OVER (PARTITION BY ci.court_id ORDER BY COUNT(*) DESC, MAX(ci.created_at) DESC) as rank
FROM public.check_ins ci
GROUP BY ci.court_id, ci.user_id;

-- Step 8: Grant select on leaderboard view
GRANT SELECT ON public.court_leaderboard TO authenticated;

-- Step 9: Create function to get top N users for a court (optimized query)
CREATE OR REPLACE FUNCTION public.get_court_leaderboard(
  court_id_param UUID,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  total_check_ins BIGINT,
  rank BIGINT,
  last_check_in TIMESTAMPTZ,
  display_name TEXT,
  username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.user_id,
    cl.total_check_ins,
    cl.rank,
    cl.last_check_in,
    p.name as display_name,
    p.username
  FROM public.court_leaderboard cl
  LEFT JOIN public.profiles p ON p.user_id = cl.user_id
  WHERE cl.court_id = court_id_param
  ORDER BY cl.rank ASC
  LIMIT limit_count;
END;
$$;

-- Step 10: Grant execute permission on leaderboard function
GRANT EXECUTE ON FUNCTION public.get_court_leaderboard(UUID, INT) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.check_ins IS 'User check-ins at courts/fields. One check-in per user per court per day.';
COMMENT ON FUNCTION public.check_in(UUID) IS 'RPC function to check in at a court. Enforces anti-spam (1 check-in per day per court).';
COMMENT ON FUNCTION public.get_court_leaderboard(UUID, INT) IS 'Returns top N users by check-in count for a specific court.';
COMMENT ON VIEW public.court_leaderboard IS 'Aggregated leaderboard view showing total check-ins per user per court.';
