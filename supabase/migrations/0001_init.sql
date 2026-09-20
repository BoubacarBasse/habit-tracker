-- Habit Tracker: shared database for Boubacar & Nawel.
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- There is no login. The app uses the public "anon" key, so anyone who has that key can do
-- exactly what the policies below allow (read everything, add/delete habits and check-ins,
-- send nudges, mark nudges read). The checks below limit the damage; they cannot make the
-- data private. Do not store anything sensitive in habit names.

-- ---------------------------------------------------------------- tables
create table public.habits (
  id         uuid primary key default gen_random_uuid(),
  owner      text not null check (owner in ('boubacar', 'nawel')),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index habits_owner_idx on public.habits (owner);

create table public.checkins (
  habit_id   uuid not null references public.habits (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create table public.nudges (
  id         uuid primary key default gen_random_uuid(),
  from_owner text not null check (from_owner in ('boubacar', 'nawel')),
  to_owner   text not null check (to_owner in ('boubacar', 'nawel')),
  habit_id   uuid references public.habits (id) on delete set null,
  created_at timestamptz not null default now(),
  read       boolean not null default false,
  check (from_owner <> to_owner)
);
create index nudges_to_idx on public.nudges (to_owner, read);

-- ---------------------------------------------------------------- guards (abuse limits)
create function public.habits_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.habits where owner = new.owner) >= 30 then
    raise exception 'That is a lot of habits. Delete one first.';
  end if;
  return new;
end $$;
create trigger habits_guard before insert on public.habits
  for each row execute function public.habits_guard();

create function public.checkins_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- +1 / -7 days of slack covers time zones and a short catch-up window.
  if new.day > current_date + 1 or new.day < current_date - 7 then
    raise exception 'That date is out of range.';
  end if;
  return new;
end $$;
create trigger checkins_guard before insert on public.checkins
  for each row execute function public.checkins_guard();

create function public.nudges_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.nudges
    where from_owner = new.from_owner
      and to_owner = new.to_owner
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Easy! You just sent a nudge. Try again in a minute.';
  end if;
  return new;
end $$;
create trigger nudges_guard before insert on public.nudges
  for each row execute function public.nudges_guard();

-- ---------------------------------------------------------------- access
alter table public.habits   enable row level security;
alter table public.checkins enable row level security;
alter table public.nudges   enable row level security;

-- Start from nothing, then grant only what the app needs.
revoke all on public.habits, public.checkins, public.nudges from anon, authenticated;
grant select, insert, delete on public.habits   to anon;
grant select, insert, delete on public.checkins to anon;
grant select, insert         on public.nudges   to anon;
grant update (read)          on public.nudges   to anon;   -- only the "read" column can change

create policy habits_select   on public.habits   for select to anon using (true);
create policy habits_insert   on public.habits   for insert to anon with check (true);
create policy habits_delete   on public.habits   for delete to anon using (true);

create policy checkins_select on public.checkins for select to anon using (true);
create policy checkins_insert on public.checkins for insert to anon with check (true);
create policy checkins_delete on public.checkins for delete to anon using (true);

create policy nudges_select   on public.nudges   for select to anon using (true);
create policy nudges_insert   on public.nudges   for insert to anon with check (true);
create policy nudges_update   on public.nudges   for update to anon using (true) with check (true);
