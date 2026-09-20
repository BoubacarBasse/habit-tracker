import { describe, it, expect } from 'vitest';
import { todayKey, shift, isDone, getStreak } from '../src/streaks.js';

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
