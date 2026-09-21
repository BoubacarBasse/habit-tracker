-- Optional cleanup. Text reminders were dropped, so the phone-number table from 0002 is unused.
-- Run once in Supabase (SQL Editor -> New query -> paste -> Run) to remove it and any saved numbers.
drop table if exists public.profiles;
