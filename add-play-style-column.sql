-- Add play_style column to profiles table
-- This allows users to specify their playing style (e.g., "Shot Creator", "3&D", "Playmaker", etc.)

-- Add play_style column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS play_style TEXT;

-- Add check constraint to limit length (max 24 chars for custom, but predefined options can be longer)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_play_style_length_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_play_style_length_check 
CHECK (play_style IS NULL OR char_length(play_style) <= 24);

-- Note: RLS policy "Users can update their own profile" already covers play_style updates
-- since it uses: FOR UPDATE USING (auth.uid() = user_id)
-- This allows authenticated users to update any column in their own profile, including play_style
