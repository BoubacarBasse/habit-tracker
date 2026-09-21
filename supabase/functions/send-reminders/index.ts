// Supabase Edge Function: text reminders through Twilio.
//
// Two jobs, both protected by the x-cron-secret header:
//   1. Morning digest. Called every hour by pg_cron. Texts each person once a day, at SEND_HOUR in
//      their own time zone, with what is on their list today.
//   2. Nudge. Called by a database trigger when one person nudges the other.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   CRON_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
//
// Manual testing (still needs the secret header): POST {"dry": true} to see the messages without
// sending; {"force": true, "only": "nawel"} to send to one person regardless of the hour.

export const SEND_HOUR = 8; // local hour of the morning text
const NAMES: Record<string, string> = { boubacar: 'Boubacar', nawel: 'Nawel' };
const partnerOf = (o: string) => (o === 'boubacar' ? 'nawel' : 'boubacar');
const MAX_BODY = 1500; // Twilio's limit is 1600

type Habit = { id: string; owner: string; name: string; days: number[]; created_at: string };
type Profile = { owner: string; phone: string | null; remind: boolean; tz: string; last_sent: string | null };

// The date, weekday (0 = Sunday) and hour right now in a time zone. Falls back to New York.
export function localParts(now: Date, tz: string) {
  let zone = tz;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); } catch { zone = 'America/New_York'; }
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { day: `${p.year}-${p.month}-${p.day}`, weekday, hour: Number(p.hour), zone };
}

function dayInZone(iso: string, zone: string) {
  return localParts(new Date(iso), zone).day;
}

// What `person` has on their list today: their own habits and the shared ones scheduled for
// today's weekday, created by today, and not already checked off.
export function todaysItems(person: string, habits: Habit[], doneIds: Set<string>, today: string, weekday: number, zone: string) {
  const due = (h: Habit) =>
    (h.days?.length ? h.days : [0, 1, 2, 3, 4, 5, 6]).includes(weekday) &&
    dayInZone(h.created_at, zone) <= today && !doneIds.has(h.id);
  return {
    mine: habits.filter((h) => h.owner === person && due(h)).map((h) => h.name),
    shared: habits.filter((h) => h.owner === 'both' && due(h)).map((h) => h.name),
  };
}

export function buildDigest(person: string, items: { mine: string[]; shared: string[] }): string | null {
  if (!items.mine.length && !items.shared.length) return null;
  const lines = [`Good morning ${NAMES[person]}! On your list today:`];
  for (const n of items.mine) lines.push(`- ${n}`);
  if (items.shared.length) {
    lines.push(`With ${NAMES[partnerOf(person)]}:`);
    for (const n of items.shared) lines.push(`- ${n}`);
  }
  let body = lines.join('\n');
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1) + '…';
  return body;
}

export function buildNudge(from: string, habitName: string | null): string {
  const about = habitName ? ` about "${habitName}"` : '';
  return `${NAMES[from] ?? 'Your partner'} nudged you${about}. Time to check it off!`;
}

// ---------------------------------------------------------------- plumbing (only runs when deployed)
const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? '';

async function rest(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`database ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function sendSms(to: string, body: string) {
  const sid = env('TWILIO_ACCOUNT_SID');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${env('TWILIO_AUTH_TOKEN')}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: env('TWILIO_FROM'), Body: body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`twilio ${res.status}: ${err.message ?? 'send failed'} (code ${err.code ?? '?'})`);
  }
}

async function digest(opts: { force?: boolean; only?: string; dry?: boolean }) {
  const now = new Date();
  const profiles: Profile[] = await rest('profiles?select=owner,phone,remind,tz,last_sent&remind=eq.true&phone=not.is.null');
  const habits: Habit[] = await rest('habits?select=id,owner,name,days,created_at');
  const results: Record<string, string> = {};

  for (const p of profiles) {
    if (opts.only && p.owner !== opts.only) continue;
    const t = localParts(now, p.tz);
    if (!opts.force && t.hour !== SEND_HOUR) { results[p.owner] = `skipped (local hour ${t.hour})`; continue; }
    if (!opts.force && p.last_sent === t.day) { results[p.owner] = 'skipped (already sent today)'; continue; }
    const checks: { habit_id: string }[] = await rest(`checkins?select=habit_id&owner=eq.${p.owner}&day=eq.${t.day}`);
    const items = todaysItems(p.owner, habits, new Set(checks.map((c) => c.habit_id)), t.day, t.weekday, t.zone);
    const text = buildDigest(p.owner, items);
    if (!text) { results[p.owner] = 'nothing to send'; continue; }
    if (opts.dry) { results[p.owner] = text; continue; }
    try {
      await sendSms(p.phone!, text);
      if (!opts.force) await rest(`profiles?owner=eq.${p.owner}`, { method: 'PATCH', body: JSON.stringify({ last_sent: t.day }) });
      results[p.owner] = 'sent';
    } catch (e) {
      results[p.owner] = `failed: ${(e as Error).message}`;
    }
  }
  return results;
}

async function nudge(record: { from_owner: string; to_owner: string; habit_id: string | null }) {
  const rows: Profile[] = await rest(`profiles?select=owner,phone,remind,tz,last_sent&owner=eq.${record.to_owner}`);
  const p = rows[0];
  if (!p || !p.phone || !p.remind) return { status: 'no number on file' };
  let name: string | null = null;
  if (record.habit_id) {
    const h = await rest(`habits?select=name&id=eq.${record.habit_id}`);
    name = h[0]?.name ?? null;
  }
  await sendSms(p.phone, buildNudge(record.from_owner, name));
  return { status: 'sent' };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const D = (globalThis as any).Deno;
if (D?.serve) {
  D.serve(async (req: Request) => {
    const secret = env('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    try {
      if (body.type === 'nudge' && body.record) return json(await nudge(body.record));
      return json(await digest({ force: !!body.force, only: body.only, dry: !!body.dry }));
    } catch (e) {
      console.error(e);
      return json({ error: (e as Error).message }, 500);
    }
  });
}
