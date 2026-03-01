-- Fix: court_chat_messages RLS policy re-evaluates auth.uid() per row
-- Run in Supabase SQL Editor
-- Use (select auth.uid()) for single evaluation per statement.

drop policy if exists "chat_insert_own_user" on public.court_chat_messages;
create policy "chat_insert_own_user"
on public.court_chat_messages
for insert
to authenticated
with check ((select auth.uid()) = user_id);
