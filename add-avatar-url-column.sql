-- Add avatar_url column to profiles table if it doesn't exist
-- Run this in your Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN profiles.avatar_url IS 'URL to the user profile picture stored in Supabase Storage';
