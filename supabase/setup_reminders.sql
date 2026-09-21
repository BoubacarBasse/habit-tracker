-- Text reminders: schedule + nudge trigger. NOT a migration: it contains secrets once filled in,
-- so fill the three <<placeholders>> in Supabase's SQL Editor and never commit the filled version.
--
--   <<PROJECT_URL>>  e.g. https://abcdefgh.supabase.co
--   <<ANON_KEY>>     the public anon key (lets the call through Supabase's JWT check)
--   <<CRON_SECRET>>  the same random string you saved as the CRON_SECRET function secret
--
-- Run 0003_reminder_log.sql first, and deploy the send-reminders function.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 1. Every hour, on the hour. The function itself texts each person only at 8am their time.
select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');
select cron.schedule(
  'send-reminders',
  '0 * * * *',
  $$select net.http_post(
      url     := '<<PROJECT_URL>>/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <<ANON_KEY>>',
        'x-cron-secret', '<<CRON_SECRET>>'),
      body    := '{}'::jsonb)$$
);

-- 2. Text the person when their partner nudges them. A failed call never blocks the nudge itself.
create or replace function public.notify_nudge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform net.http_post(
      url     := '<<PROJECT_URL>>/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <<ANON_KEY>>',
        'x-cron-secret', '<<CRON_SECRET>>'),
      body    := jsonb_build_object('type', 'nudge', 'record', to_jsonb(new)));
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists nudges_notify on public.nudges;
create trigger nudges_notify after insert on public.nudges
  for each row execute function public.notify_nudge();
