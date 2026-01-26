create table public.health_check (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now()
);

-- Insert a dummy row so the specific select query always finds something
insert into public.health_check (id) values (default);
