-- Habit Tracker v3: weekly schedules + text-message reminders.
-- Run this ONCE in Supabase (SQL Editor -> New query -> paste -> Run), after 0001_init.sql.
--
-- 1. Each habit gets a weekly schedule: the weekdays it applies to (0 = Sunday ... 6 = Saturday).
--    Existing habits stay "every day".
-- 2. A `profiles` table holds each person's phone number for reminders. The browser can WRITE a
--    number but can never READ one back (no select permission on the phone column).

-- ---------------------------------------------------------------- schedule
alter table public.habits
  add column days smallint[] not null default '{0,1,2,3,4,5,6}',
  add constraint habits_days_valid check (
    cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );

grant update (days) on public.habits to anon;
create policy habits_update on public.habits for update to anon using (true) with check (true);

-- ---------------------------------------------------------------- reminders
create table public.profiles (
  owner  text primary key check (owner in ('boubacar', 'nawel')),
  phone  text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),  -- e.g. +15551234567
  remind boolean not null default true,
  tz     text not null default 'America/New_York' check (char_length(tz) between 1 and 64)
);

insert into public.profiles (owner) values ('boubacar'), ('nawel');

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select (owner) on public.profiles to anon;                 -- lets an update find its row; phone stays hidden
grant update (phone, remind, tz) on public.profiles to anon;

create policy profiles_select on public.profiles for select to anon using (true);
create policy profiles_update on public.profiles for update to anon using (true) with check (true);
