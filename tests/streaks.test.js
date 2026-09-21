import { describe, it, expect } from 'vitest';
import { todayKey, shift, isDone, getStreak, isScheduled, weekdayOf } from '../src/streaks.js';

const habit = (days) => ({ days });

describe('todayKey', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(todayKey(new Date(2025, 5, 5))).toBe('2025-06-05');
  });
  it('uses local time, not UTC', () => {
    expect(todayKey(new Date(2025, 0, 1, 23, 59))).toBe('2025-01-01');
    expect(todayKey(new Date(2025, 0, 1, 0, 1))).toBe('2025-01-01');
  });
});

describe('shift', () => {
  it('moves across month and year boundaries', () => {
    expect(shift('2025-03-01', -1)).toBe('2025-02-28');
    expect(shift('2025-01-01', -1)).toBe('2024-12-31');
    expect(shift('2024-03-01', -1)).toBe('2024-02-29');
    expect(shift('2025-12-31', 1)).toBe('2026-01-01');
  });
});

describe('isDone', () => {
  it('checks a specific date', () => {
    expect(isDone(habit(['2025-06-15']), '2025-06-15')).toBe(true);
    expect(isDone(habit(['2025-06-14']), '2025-06-15')).toBe(false);
  });
  it('is false for missing or malformed habits', () => {
    expect(isDone(null, '2025-06-15')).toBe(false);
    expect(isDone({}, '2025-06-15')).toBe(false);
  });
});

describe('getStreak', () => {
  const today = '2025-06-15';
  it('is 0 with no days, or for a missing habit', () => {
    expect(getStreak(habit([]), today)).toBe(0);
    expect(getStreak(null, today)).toBe(0);
  });
  it('counts consecutive days ending today', () => {
    expect(getStreak(habit(['2025-06-13', '2025-06-14', '2025-06-15']), today)).toBe(3);
  });
  it('keeps yesterday\'s streak while today is still open', () => {
    expect(getStreak(habit(['2025-06-13', '2025-06-14']), today)).toBe(2);
  });
  it('is 0 once a full day has been missed', () => {
    expect(getStreak(habit(['2025-06-12', '2025-06-13']), today)).toBe(0);
  });
  it('stops at a gap', () => {
    expect(getStreak(habit(['2025-06-10', '2025-06-11', '2025-06-14', '2025-06-15']), today)).toBe(2);
  });
  it('handles long streaks across month boundaries', () => {
    const days = [];
    for (let i = 0; i < 45; i++) days.push(shift(today, -i));
    expect(getStreak(habit(days), today)).toBe(45);
  });
});

// 2025-06-16 is a Monday.
describe('weekdayOf / isScheduled', () => {
  it('finds the weekday of a local date', () => {
    expect(weekdayOf('2025-06-16')).toBe(1);
    expect(weekdayOf('2025-06-15')).toBe(0);
  });
  it('treats a habit with no schedule as every day', () => {
    expect(isScheduled({ days: [] }, '2025-06-15')).toBe(true);
    expect(isScheduled({ days: [], schedule: [] }, '2025-06-15')).toBe(true);
  });
  it('checks the weekday against the schedule', () => {
    const mwf = { days: [], schedule: [1, 3, 5] };
    expect(isScheduled(mwf, '2025-06-16')).toBe(true);
    expect(isScheduled(mwf, '2025-06-17')).toBe(false);
  });
});

describe('getStreak with a weekly schedule', () => {
  const mwf = (days) => ({ days, schedule: [1, 3, 5] });

  it('skips unscheduled days without breaking the streak', () => {
    // Mon 16, Fri 13, Wed 11 done; Tue/Thu/weekend are not scheduled.
    expect(getStreak(mwf(['2025-06-16', '2025-06-13', '2025-06-11']), '2025-06-16')).toBe(3);
  });
  it('a missed scheduled day ends the streak', () => {
    // Fri 13 was missed.
    expect(getStreak(mwf(['2025-06-16', '2025-06-11']), '2025-06-16')).toBe(1);
  });
  it('today scheduled but not done yet keeps the earlier streak', () => {
    expect(getStreak(mwf(['2025-06-13', '2025-06-11']), '2025-06-16')).toBe(2);
  });
  it('today unscheduled keeps the streak alive', () => {
    // Tuesday 17: nothing due today, Monday was done.
    expect(getStreak(mwf(['2025-06-16', '2025-06-13']), '2025-06-17')).toBe(2);
  });
  it('a bonus check-in on an unscheduled day is not counted', () => {
    expect(getStreak(mwf(['2025-06-17', '2025-06-16']), '2025-06-17')).toBe(1);
  });
  it('a habit with no history has no streak', () => {
    expect(getStreak(mwf([]), '2025-06-16')).toBe(0);
  });
  it('an every-day habit still behaves as before', () => {
    expect(getStreak({ days: ['2025-06-16', '2025-06-15', '2025-06-14'] }, '2025-06-16')).toBe(3);
  });
});
