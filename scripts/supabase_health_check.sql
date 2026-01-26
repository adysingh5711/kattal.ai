-- Run this in your Supabase SQL Editor

-- 1. Create table (if it doesn't exist)
create table if not exists public.health_check (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now()
);

-- 2. Enable RLS (Row Level Security)
alter table public.health_check enable row level security;

-- 3. Create Policy to allow reading by anyone (anon and authenticated)
-- Drop policy first if you are re-running this script
drop policy if exists "Allow public read access" on public.health_check;

create policy "Allow public read access"
on public.health_check
for select
to anon, authenticated
using (true);

-- 4. Insert a dummy row (if table is empty)
-- Using a PL/pgSQL block to handle the conditional insert safely
do $$
begin
  if not exists (select 1 from public.health_check) then
    insert into public.health_check default values;
  end if;
end
$$;
