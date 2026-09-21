import { supabase } from './supabaseClient.js';
import { todayKey, shift, ALL_WEEK } from './streaks.js';

export const OWNERS = ['boubacar', 'nawel'];
export const NAMES = { boubacar: 'Boubacar', nawel: 'Nawel' };
export const partnerOf = (me) => (me === 'boubacar' ? 'nawel' : 'boubacar');

const MAX_NAME = 60;
const HISTORY_DAYS = 400;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request
export const NETWORK_MSG = "Can't reach the server. Check your connection.";

let client = supabase;
export function setClient(c) {
  client = c; // tests inject a fake
}

function db() {
  if (!client) throw new Error('The app is not connected to its database yet.');
  return client;
}

// ---------------------------------------------------------------- errors
function toError(e) {
  if (e && e.code === 'P0001') return new Error(e.message); // our own database rules, already friendly
  if (!e || !e.code || /fetch|network/i.test(e.message || '')) return new Error(NETWORK_MSG);
  return new Error('Something went wrong. Please try again.');
}

async function exec(query) {
  try {
    return await query;
  } catch {
    return { data: null, error: { message: 'Failed to fetch' } };
  }
}

async function run(query) {
  const { data, error } = await exec(query);
  if (error) throw toError(error);
  return data;
}

// ---------------------------------------------------------------- shaping data
// habit.doneBy = who checked it on which days. habit.days = days that count as done:
// a personal habit counts the owner's days; a shared habit counts days BOTH checked.
function daysFor(owner, doneBy) {
  if (owner !== 'both') return doneBy[owner] || [];
  const other = new Set(doneBy.nawel);
  return doneBy.boubacar.filter((d) => other.has(d));
}

// Weekdays 0-6 (Sunday = 0), sorted and unique. Anything unusable means "every day".
export function cleanDays(days) {
  if (!Array.isArray(days)) return [...ALL_WEEK];
  const list = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  return list.length ? list : [...ALL_WEEK];
}

function toHabit(row, doneBy) {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    createdAt: row.created_at,
    shared: row.owner === 'both',
    schedule: cleanDays(row.days),
    doneBy,
    days: daysFor(row.owner, doneBy),
  };
}

export function buildHabits(habitRows, checkinRows) {
  const byHabit = new Map();
  for (const c of checkinRows) {
    if (!byHabit.has(c.habit_id)) byHabit.set(c.habit_id, { boubacar: [], nawel: [] });
    const lists = byHabit.get(c.habit_id);
    if (lists[c.owner]) lists[c.owner].push(c.day);
  }
  return habitRows.map((h) => {
    const doneBy = byHabit.get(h.id) || { boubacar: [], nawel: [] };
    doneBy.boubacar.sort();
    doneBy.nawel.sort();
    return toHabit(h, doneBy);
  });
}

// Returns a copy of `habit` with `who`'s check-in on `day` set or cleared (used for instant UI updates).
export function applyCheck(habit, who, day, checked) {
  const list = habit.doneBy[who].filter((d) => d !== day);
  if (checked) list.push(day);
  list.sort();
  const doneBy = { ...habit.doneBy, [who]: list };
  return { ...habit, doneBy, days: daysFor(habit.owner, doneBy) };
}

// ---------------------------------------------------------------- reads
async function fetchCheckins(since) {
  const rows = [];
  for (let from = 0; from < 50 * PAGE; from += PAGE) {
    const page = await run(
      db().from('checkins').select('habit_id, owner, day').gte('day', since)
        .order('day', { ascending: false }).order('habit_id').order('owner')
        .range(from, from + PAGE - 1),
    );
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// Everything the screens need: my habits, my partner's habits, and the shared ones.
export async function loadBoard(me, today = todayKey()) {
  const since = shift(today, -HISTORY_DAYS);
  const [habitRows, checkinRows] = await Promise.all([
    run(db().from('habits').select('id, owner, name, days, created_at').order('created_at', { ascending: true })),
    fetchCheckins(since),
  ]);
  const all = buildHabits(habitRows, checkinRows);
  const partner = partnerOf(me);
  return {
    me,
    partner,
    mine: all.filter((h) => h.owner === me),
    theirs: all.filter((h) => h.owner === partner),
    shared: all.filter((h) => h.shared),
  };
}

// ---------------------------------------------------------------- writes
export async function addHabit(owner, name, days = ALL_WEEK) {
  if (![...OWNERS, 'both'].includes(owner)) throw new Error('Unknown person.');
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new Error('Habit name cannot be empty');
  if (trimmed.length > MAX_NAME) throw new Error(`Habit name must be at most ${MAX_NAME} characters`);
  if (!Array.isArray(days) || !days.length) throw new Error('Pick at least one day.');
  const row = await run(
    db().from('habits').insert({ owner, name: trimmed, days: cleanDays(days) })
      .select('id, owner, name, days, created_at').single(),
  );
  return toHabit(row, { boubacar: [], nawel: [] });
}

export async function setHabitDays(id, days) {
  if (!Array.isArray(days) || !days.length) throw new Error('Pick at least one day.');
  await run(db().from('habits').update({ days: cleanDays(days) }).eq('id', id));
}

export async function deleteHabit(id) {
  await run(db().from('habits').delete().eq('id', id));
}

// Sets (or clears) `who`'s check-in for a day. Safe to call twice.
export async function setChecked(habitId, who, checked, day = todayKey()) {
  if (!OWNERS.includes(who)) throw new Error('Unknown person.');
  if (checked) {
    const { error } = await exec(db().from('checkins').insert({ habit_id: habitId, owner: who, day }));
    if (error && error.code !== '23505') throw toError(error); // 23505 = already checked
  } else {
    await run(db().from('checkins').delete().match({ habit_id: habitId, owner: who, day }));
  }
}

// ---------------------------------------------------------------- nudges
export async function sendNudge(from, to, habitId = null) {
  if (!OWNERS.includes(from) || !OWNERS.includes(to) || from === to) throw new Error('Unknown person.');
  await run(db().from('nudges').insert({ from_owner: from, to_owner: to, habit_id: habitId }));
}

export async function listNudges(me) {
  return run(
    db().from('nudges').select('id, from_owner, habit_id, created_at')
      .eq('to_owner', me).eq('read', false).order('created_at', { ascending: false }),
  );
}

export async function markNudgesRead(me) {
  await run(db().from('nudges').update({ read: true }).eq('to_owner', me).eq('read', false));
}

// ---------------------------------------------------------------- text reminders
// Turns what someone typed into +15551234567 form. A 10-digit number is assumed to be US/Canada.
// Returns null for empty input (which turns reminders off) and throws for anything unusable.
export function normalizePhone(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  let e164;
  if (raw.startsWith('+')) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  else e164 = '';
  if (!/^\+[1-9][0-9]{7,14}$/.test(e164)) {
    throw new Error('Enter a phone number like 555 123 4567, or with a country code like +33 6 12 34 56 78.');
  }
  return e164;
}

// The browser can save a number but never read one back, so callers keep their own "saved" flag.
export async function savePhone(who, phone, remind = true) {
  if (!OWNERS.includes(who)) throw new Error('Unknown person.');
  const value = normalizePhone(phone);
  let tz = 'America/New_York';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch { /* keep default */ }
  await run(db().from('profiles').update({ phone: value, remind: remind && !!value, tz }).eq('owner', who));
  return value;
}
