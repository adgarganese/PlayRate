-- 1) Table
create table if not exists public.court_chat_messages (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 280),
  created_at timestamptz not null default now()
);

-- 2) Helpful indexes
create index if not exists court_chat_messages_court_time_idx
  on public.court_chat_messages (court_id, created_at desc);

create index if not exists court_chat_messages_user_time_idx
  on public.court_chat_messages (user_id, created_at desc);

-- 3) RLS
alter table public.court_chat_messages enable row level security;

-- Read: any authenticated user
create policy "chat_read_authenticated"
on public.court_chat_messages
for select
to authenticated
using (true);

-- Write: authenticated users can insert as themselves
create policy "chat_insert_own_user"
on public.court_chat_messages
for insert
to authenticated
with check ((select auth.uid()) = user_id);
