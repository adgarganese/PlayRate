-- Fix: highlights_with_counts view SECURITY DEFINER issue
-- Run in Supabase SQL Editor
--
-- Problem: View was defined with SECURITY DEFINER, bypassing RLS of the querying user.
-- Fix: Set security_invoker = true so the view runs with the caller's privileges
--      and RLS policies on highlights/highlight_likes/highlight_comments apply correctly.

ALTER VIEW public.highlights_with_counts SET (security_invoker = true);
