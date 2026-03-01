-- Fix: "infinite recursion detected in policy for relation conversation_participants"
-- Run this ENTIRE block in Supabase Dashboard → SQL Editor → New query → Run.
--
-- Step 1: Remove the policy that causes recursion (if it exists)
DROP POLICY IF EXISTS "conversation_participants_select_same_conversation" ON public.conversation_participants;

-- Step 2: Verify only the intended policy remains (optional; for debugging)
-- After running, you should see only "conversation_participants_select_own" for SELECT.
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'conversation_participants';
