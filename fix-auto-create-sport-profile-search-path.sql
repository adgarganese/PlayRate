-- Fix: Functions with mutable search_path
-- Run in Supabase SQL Editor
--
-- Problem: Functions without explicit search_path can be vulnerable to search path injection.
-- Fix: Set search_path to 'public' so unqualified table names resolve predictably.

ALTER FUNCTION public.auto_create_sport_profile() SET search_path = 'public';
ALTER FUNCTION public.update_sport_profile_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_court_rating_updated_at() SET search_path = 'public';
ALTER FUNCTION public.set_court_address_key() SET search_path = 'public';
ALTER FUNCTION public.get_court_rating_info(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.prevent_cosigns_update_delete() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.validate_self_rating_update() SET search_path = 'public';
