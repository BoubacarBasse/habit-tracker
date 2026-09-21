-- Text reminders: remember the last day each person was texted, so the hourly job never texts twice.
-- Run ONCE in Supabase (SQL Editor -> New query -> paste -> Run), after 0002.
-- The browser (anon) has no access to this column; only the reminder function does.
alter table public.profiles add column last_sent date;
