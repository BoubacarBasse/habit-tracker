import { describe, it, expect } from 'vitest';
import { localParts, todaysItems, buildDigest, buildNudge, SEND_HOUR } from '../supabase/functions/send-reminders/index.ts';

const habit = (over) => ({ id: 'h', owner: 'boubacar', name: 'Run', days: [0, 1, 2, 3, 4, 5, 6], created_at: '2026-01-01T12:00:00Z', ...over });

describe('localParts', () => {
  it('reads the date, weekday and hour in the given time zone', () => {
    // 12:30 UTC on Mon 2026-09-21 is 08:30 in New York (EDT).
    const t = localParts(new Date('2026-09-21T12:30:00Z'), 'America/New_York');
    expect(t).toMatchObject({ day: '2026-09-21', weekday: 1, hour: 8 });
  });
  it('rolls the date back for zones behind UTC', () => {
    const t = localParts(new Date('2026-09-21T02:00:00Z'), 'America/New_York');
    expect(t).toMatchObject({ day: '2026-09-20', weekday: 0, hour: 22 });
  });
  it('falls back to New York for an unknown zone', () => {
    expect(localParts(new Date('2026-09-21T12:30:00Z'), 'Mars/Base').hour).toBe(8);
  });
  it('the morning hour is 8', () => expect(SEND_HOUR).toBe(8));
});

describe('todaysItems', () => {
  const today = '2026-09-21'; // Monday
  const args = (habits, done = new Set()) => todaysItems('boubacar', habits, done, today, 1, 'America/New_York');

  it('lists own and shared habits scheduled for today', () => {
    const r = args([
      habit({ id: 'a', name: 'Gym', days: [1, 3, 5] }),
      habit({ id: 'b', name: 'Yoga', days: [2] }),
      habit({ id: 'c', owner: 'nawel', name: 'Hers' }),
      habit({ id: 'd', owner: 'both', name: 'Walk', days: [1] }),
    ]);
    expect(r).toEqual({ mine: ['Gym'], shared: ['Walk'] });
  });
  it('skips habits already checked off and ones created later', () => {
    const r = args(
      [habit({ id: 'a', name: 'Done' }), habit({ id: 'b', name: 'New', created_at: '2026-09-22T12:00:00Z' })],
      new Set(['a']),
    );
    expect(r).toEqual({ mine: [], shared: [] });
  });
});

describe('messages', () => {
  it('builds the morning text', () => {
    expect(buildDigest('boubacar', { mine: ['Gym', 'Read'], shared: ['Walk'] })).toBe(
      'Good morning Boubacar! On your list today:\n- Gym\n- Read\nWith Nawel:\n- Walk',
    );
  });
  it('sends nothing when nothing is planned', () => {
    expect(buildDigest('nawel', { mine: [], shared: [] })).toBeNull();
  });
  it('stays under the SMS length limit', () => {
    const many = Array.from({ length: 200 }, (_, i) => `Habit number ${i}`);
    expect(buildDigest('nawel', { mine: many, shared: [] }).length).toBeLessThanOrEqual(1500);
  });
  it('builds the nudge text', () => {
    expect(buildNudge('nawel', 'Gym')).toBe('Nawel nudged you about "Gym". Time to check it off!');
    expect(buildNudge('nawel', null)).toBe('Nawel nudged you. Time to check it off!');
  });
});
