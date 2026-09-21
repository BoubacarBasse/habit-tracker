import { describe, it, expect, beforeEach } from 'vitest';
import {
  setClient, buildHabits, applyCheck, loadBoard, addHabit, deleteHabit, setChecked,
  setHabitDays, cleanDays, normalizePhone, savePhone,
  sendNudge, listNudges, markNudgesRead, partnerOf, NETWORK_MSG,
} from '../src/store.js';
import { getStreak, shift } from '../src/streaks.js';
import { makeFakeClient } from './fakeClient.js';

let fake;
beforeEach(() => {
  fake = makeFakeClient();
  setClient(fake);
});

describe('buildHabits', () => {
  const rows = [
    { id: 'p', owner: 'boubacar', name: 'Run', created_at: 't' },
    { id: 's', owner: 'both', name: 'Walk', created_at: 't' },
  ];
  const checks = [
    { habit_id: 'p', owner: 'boubacar', day: '2025-06-15' },
    { habit_id: 'p', owner: 'boubacar', day: '2025-06-14' },
    { habit_id: 's', owner: 'boubacar', day: '2025-06-15' },
    { habit_id: 's', owner: 'boubacar', day: '2025-06-14' },
    { habit_id: 's', owner: 'nawel', day: '2025-06-14' },
  ];

  it('personal habits count the owner\'s days, sorted', () => {
    const [run] = buildHabits(rows, checks);
    expect(run.days).toEqual(['2025-06-14', '2025-06-15']);
    expect(run.shared).toBe(false);
  });

  it('shared habits only count days BOTH people checked', () => {
    const walk = buildHabits(rows, checks)[1];
    expect(walk.shared).toBe(true);
    expect(walk.days).toEqual(['2025-06-14']);
    expect(walk.doneBy.boubacar).toHaveLength(2);
    expect(walk.doneBy.nawel).toEqual(['2025-06-14']);
  });

  it('a shared streak breaks when only one person checks in', () => {
    const walk = buildHabits(rows, checks)[1];
    expect(getStreak(walk, '2025-06-15')).toBe(1); // 15th is open, 14th complete
    expect(getStreak(walk, '2025-06-16')).toBe(0); // 15th was missed by Nawel
  });

  it('ignores check-ins from an unknown person', () => {
    const [run] = buildHabits(rows, [{ habit_id: 'p', owner: 'someone', day: '2025-06-15' }]);
    expect(run.days).toEqual([]);
  });
});

describe('applyCheck', () => {
  it('checks and unchecks without changing the original', () => {
    const [walk] = buildHabits([{ id: 's', owner: 'both', name: 'Walk', created_at: 't' }], []);
    const b = applyCheck(walk, 'boubacar', '2025-06-15', true);
    expect(walk.doneBy.boubacar).toEqual([]);
    expect(b.days).toEqual([]);
    const both = applyCheck(b, 'nawel', '2025-06-15', true);
    expect(both.days).toEqual(['2025-06-15']);
    expect(applyCheck(both, 'nawel', '2025-06-15', false).days).toEqual([]);
  });
});

describe('addHabit', () => {
  it('adds a personal or shared habit', async () => {
    const mine = await addHabit('nawel', '  Read  ');
    expect(mine).toMatchObject({ owner: 'nawel', name: 'Read', shared: false, days: [] });
    const both = await addHabit('both', 'Walk');
    expect(both.shared).toBe(true);
    expect(fake.tables.habits).toHaveLength(2);
  });
  it('rejects empty, too long, and unknown owners before calling the server', async () => {
    await expect(addHabit('nawel', '   ')).rejects.toThrow('empty');
    await expect(addHabit('nawel', 'x'.repeat(61))).rejects.toThrow('60');
    await expect(addHabit('mallory', 'Hack')).rejects.toThrow('Unknown person');
    expect(fake.calls).toEqual([]);
  });
  it('allows exactly 60 characters', async () => {
    await expect(addHabit('nawel', 'x'.repeat(60))).resolves.toBeTruthy();
  });
});

describe('setChecked', () => {
  it('checks, is safe to repeat, and unchecks', async () => {
    const h = await addHabit('both', 'Walk');
    await setChecked(h.id, 'boubacar', true, '2025-06-15');
    await setChecked(h.id, 'boubacar', true, '2025-06-15'); // duplicate is fine
    expect(fake.tables.checkins).toHaveLength(1);
    await setChecked(h.id, 'nawel', true, '2025-06-15');
    expect(fake.tables.checkins).toHaveLength(2);
    await setChecked(h.id, 'boubacar', false, '2025-06-15');
    expect(fake.tables.checkins.map((c) => c.owner)).toEqual(['nawel']);
  });
  it('rejects an unknown person', async () => {
    await expect(setChecked('x', 'mallory', true)).rejects.toThrow('Unknown person');
  });
});

describe('loadBoard', () => {
  it('splits habits into mine, theirs and shared for whoever is looking', async () => {
    await addHabit('boubacar', 'Run');
    await addHabit('nawel', 'Read');
    await addHabit('both', 'Walk');
    const b = await loadBoard('boubacar', '2025-06-15');
    expect(b.mine.map((h) => h.name)).toEqual(['Run']);
    expect(b.theirs.map((h) => h.name)).toEqual(['Read']);
    expect(b.shared.map((h) => h.name)).toEqual(['Walk']);
    expect(b.partner).toBe('nawel');
    const n = await loadBoard('nawel', '2025-06-15');
    expect(n.mine.map((h) => h.name)).toEqual(['Read']);
  });

  it('reads every check-in even past the 1000-row page limit', async () => {
    const today = '2025-01-01';
    for (const id of ['a', 'b', 'c']) {
      fake.tables.habits.push({ id, owner: 'both', name: id, created_at: 't' });
      for (let i = 0; i < 350; i++) {
        for (const owner of ['boubacar', 'nawel']) fake.tables.checkins.push({ habit_id: id, owner, day: shift(today, -i) });
      }
    }
    expect(fake.tables.checkins).toHaveLength(2100);
    const b = await loadBoard('boubacar', today);
    for (const h of b.shared) {
      expect(h.doneBy.boubacar).toHaveLength(350);
      expect(h.doneBy.nawel).toHaveLength(350);
      expect(h.days).toHaveLength(350);
      expect(getStreak(h, today)).toBe(350);
    }
  });
});

describe('deleteHabit', () => {
  it('removes the habit and its check-ins', async () => {
    const h = await addHabit('boubacar', 'Run');
    await setChecked(h.id, 'boubacar', true, '2025-06-15');
    await deleteHabit(h.id);
    expect(fake.tables.habits).toHaveLength(0);
    expect(fake.tables.checkins).toHaveLength(0);
  });
});

describe('nudges', () => {
  it('sends, lists unread, and marks read', async () => {
    const h = await addHabit('nawel', 'Read');
    await sendNudge('boubacar', 'nawel', h.id);
    await sendNudge('nawel', 'boubacar');
    expect(await listNudges('nawel')).toHaveLength(1);
    expect((await listNudges('nawel'))[0]).toMatchObject({ from_owner: 'boubacar', habit_id: h.id });
    await markNudgesRead('nawel');
    expect(await listNudges('nawel')).toHaveLength(0);
    expect(await listNudges('boubacar')).toHaveLength(1); // untouched
  });
  it('cannot nudge yourself or an unknown person', async () => {
    await expect(sendNudge('nawel', 'nawel')).rejects.toThrow('Unknown person');
    await expect(sendNudge('nawel', 'mallory')).rejects.toThrow('Unknown person');
  });
});

describe('errors', () => {
  it('turns a network failure into a friendly message (returned error)', async () => {
    fake.failNext = { message: 'TypeError: Failed to fetch' };
    await expect(loadBoard('boubacar')).rejects.toThrow(NETWORK_MSG);
  });
  it('turns a thrown network failure into the same message', async () => {
    fake.failNext = { throw: true };
    await expect(addHabit('nawel', 'Read')).rejects.toThrow(NETWORK_MSG);
  });
  it('passes through the database\'s own rule messages', async () => {
    fake.failNext = { code: 'P0001', message: 'Easy! You just sent a nudge. Try again in a minute.' };
    await expect(sendNudge('boubacar', 'nawel')).rejects.toThrow('Easy!');
  });
  it('hides unexpected database errors behind a generic message', async () => {
    fake.failNext = { code: '42501', message: 'permission denied for table habits' };
    await expect(deleteHabit('x')).rejects.toThrow('Something went wrong');
  });
  it('explains when the app has no database configured', async () => {
    setClient(null);
    await expect(loadBoard('boubacar')).rejects.toThrow('not connected');
  });
});

describe('partnerOf', () => {
  it('flips between the two people', () => {
    expect(partnerOf('boubacar')).toBe('nawel');
    expect(partnerOf('nawel')).toBe('boubacar');
  });
});

describe('schedule', () => {
  let fake;
  beforeEach(() => { fake = makeFakeClient(); setClient(fake); });

  it('cleanDays sorts, dedupes and defaults to every day', () => {
    expect(cleanDays([5, 1, 1, 3])).toEqual([1, 3, 5]);
    expect(cleanDays(undefined)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(cleanDays([9, -1, 'x'])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('a new habit defaults to every day and can be limited to some weekdays', async () => {
    const all = await addHabit('boubacar', 'Run');
    expect(all.schedule).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const some = await addHabit('boubacar', 'Gym', [5, 1, 3]);
    expect(some.schedule).toEqual([1, 3, 5]);
    expect(fake.tables.habits[1].days).toEqual([1, 3, 5]);
  });
  it('rejects an empty schedule', async () => {
    await expect(addHabit('boubacar', 'Gym', [])).rejects.toThrow('at least one day');
  });
  it('loadBoard returns each habit schedule', async () => {
    await addHabit('boubacar', 'Gym', [1, 3]);
    const board = await loadBoard('boubacar');
    expect(board.mine[0].schedule).toEqual([1, 3]);
  });
  it('setHabitDays updates the schedule', async () => {
    const h = await addHabit('nawel', 'Yoga');
    await setHabitDays(h.id, [2, 4]);
    expect(fake.tables.habits[0].days).toEqual([2, 4]);
    await expect(setHabitDays(h.id, [])).rejects.toThrow('at least one day');
  });
});

describe('phone reminders', () => {
  let fake;
  beforeEach(() => { fake = makeFakeClient(); setClient(fake); });

  it('normalizes common ways of typing a number', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('1 555 123 4567')).toBe('+15551234567');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('   ')).toBeNull();
  });
  it('rejects numbers that are too short or malformed', () => {
    expect(() => normalizePhone('12345')).toThrow('phone number');
    expect(() => normalizePhone('abc')).toThrow('phone number');
    expect(() => normalizePhone('+0123456789')).toThrow('phone number');
  });
  it('saves the number for the right person only', async () => {
    await savePhone('nawel', '555 123 4567');
    const nawel = fake.tables.profiles.find((p) => p.owner === 'nawel');
    const boubacar = fake.tables.profiles.find((p) => p.owner === 'boubacar');
    expect(nawel.phone).toBe('+15551234567');
    expect(nawel.remind).toBe(true);
    expect(boubacar.phone).toBeNull();
  });
  it('clearing the number turns reminders off', async () => {
    await savePhone('nawel', '555 123 4567');
    await savePhone('nawel', '');
    const nawel = fake.tables.profiles.find((p) => p.owner === 'nawel');
    expect(nawel.phone).toBeNull();
    expect(nawel.remind).toBe(false);
  });
  it('maps a network failure to the friendly message', async () => {
    fake.failNext = { throw: true };
    await expect(savePhone('nawel', '555 123 4567')).rejects.toThrow(NETWORK_MSG);
  });
});
