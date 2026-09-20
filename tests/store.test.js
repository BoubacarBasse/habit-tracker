import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getHabits,
  addHabit,
  deleteHabit,
  toggleDay,
  isDone,
  getStreak,
  todayKey
} from '../src/store.js';

describe('store.js', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // Fixed date: 2025-06-15 (Sunday)
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('todayKey', () => {
    it('returns YYYY-MM-DD for today if no date provided', () => {
      expect(todayKey()).toBe('2025-06-15');
    });

    it('returns YYYY-MM-DD for a specific date', () => {
      const date = new Date('2025-12-25T08:30:00');
      expect(todayKey(date)).toBe('2025-12-25');
    });

    it('uses local time, not UTC', () => {
      // Create a date that would differ in UTC
      const date = new Date('2025-06-15T00:30:00');
      const result = todayKey(date);
      expect(result).toBe('2025-06-15');
    });
  });

  describe('getHabits', () => {
    it('returns empty array when storage is empty', () => {
      expect(getHabits()).toEqual([]);
    });

    it('returns empty array when storage is corrupt', () => {
      localStorage.setItem('habit-tracker:v1', 'invalid json');
      expect(getHabits()).toEqual([]);
    });

    it('returns empty array when habits field is corrupt', () => {
      localStorage.setItem('habit-tracker:v1', JSON.stringify({ habits: null }));
      expect(getHabits()).toEqual([]);
    });

    it('returns habits from storage', () => {
      const habits = [
        { id: '1', name: 'Exercise', createdAt: '2025-06-01', days: ['2025-06-15'] }
      ];
      localStorage.setItem('habit-tracker:v1', JSON.stringify({ habits }));
      expect(getHabits()).toEqual(habits);
    });
  });

  describe('addHabit', () => {
    it('adds a new habit with auto-generated id and createdAt', () => {
      const habit = addHabit('Read');
      expect(habit).toHaveProperty('id');
      expect(habit).toHaveProperty('name', 'Read');
      expect(new Date(habit.createdAt).toISOString()).toBe(habit.createdAt);
      expect(habit).toHaveProperty('days', []);
    });

    it('trims whitespace from name', () => {
      const habit = addHabit('  Meditate  ');
      expect(habit.name).toBe('Meditate');
    });

    it('throws error for empty name', () => {
      expect(() => addHabit('')).toThrow(Error);
    });

    it('throws error for whitespace-only name', () => {
      expect(() => addHabit('   ')).toThrow(Error);
    });

    it('throws error for name exceeding 60 characters', () => {
      const longName = 'a'.repeat(61);
      expect(() => addHabit(longName)).toThrow(Error);
    });

    it('allows name of exactly 60 characters', () => {
      const name = 'a'.repeat(60);
      const habit = addHabit(name);
      expect(habit.name.length).toBe(60);
    });

    it('persists habit to storage', () => {
      addHabit('Yoga');
      const habits = getHabits();
      expect(habits).toHaveLength(1);
      expect(habits[0].name).toBe('Yoga');
    });

    it('generates unique ids for multiple habits', () => {
      const h1 = addHabit('Habit 1');
      const h2 = addHabit('Habit 2');
      expect(h1.id).not.toBe(h2.id);
    });
  });

  describe('deleteHabit', () => {
    it('removes habit from storage', () => {
      const habit = addHabit('Sleep');
      deleteHabit(habit.id);
      expect(getHabits()).toHaveLength(0);
    });

    it('only deletes the specified habit', () => {
      const h1 = addHabit('Drink Water');
      const h2 = addHabit('Run');
      deleteHabit(h1.id);
      const remaining = getHabits();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(h2.id);
    });

    it('does nothing if habit does not exist', () => {
      addHabit('Code');
      expect(() => deleteHabit('nonexistent')).not.toThrow();
    });
  });

  describe('toggleDay', () => {
    it('marks today as done by default', () => {
      const habit = addHabit('Stretch');
      const result = toggleDay(habit.id);
      expect(result).toBe(true);
      expect(isDone(getHabits()[0])).toBe(true);
    });

    it('marks a specific date as done', () => {
      const habit = addHabit('Walk');
      toggleDay(habit.id, '2025-06-10');
      const updated = getHabits()[0];
      expect(isDone(updated, '2025-06-10')).toBe(true);
    });

    it('toggles: second call for same day marks as not done', () => {
      const habit = addHabit('Swim');
      toggleDay(habit.id);
      const result = toggleDay(habit.id);
      expect(result).toBe(false);
      expect(isDone(getHabits()[0])).toBe(false);
    });

    it('returns false when toggling to not-done', () => {
      const habit = addHabit('Dance');
      toggleDay(habit.id);
      const result = toggleDay(habit.id);
      expect(result).toBe(false);
    });

    it('persists changes to storage', () => {
      const habit = addHabit('Journal');
      toggleDay(habit.id, '2025-06-12');
      const retrieved = getHabits()[0];
      expect(retrieved.days).toContain('2025-06-12');
    });
  });

  describe('isDone', () => {
    it('returns false when habit not done today', () => {
      const habit = addHabit('Cook');
      expect(isDone(habit)).toBe(false);
    });

    it('returns true when habit marked done today', () => {
      const habit = addHabit('Paint');
      toggleDay(habit.id);
      const updated = getHabits()[0];
      expect(isDone(updated)).toBe(true);
    });

    it('checks a specific date if provided', () => {
      const habit = addHabit('Sing');
      toggleDay(habit.id, '2025-06-14');
      const updated = getHabits()[0];
      expect(isDone(updated, '2025-06-14')).toBe(true);
      expect(isDone(updated, '2025-06-15')).toBe(false);
    });
  });

  describe('getStreak', () => {
    it('returns 0 for new habit with no days', () => {
      const habit = addHabit('Breathe');
      expect(getStreak(habit)).toBe(0);
    });

    it('returns 1 when done only today', () => {
      const habit = addHabit('Stretch');
      toggleDay(habit.id);
      const updated = getHabits()[0];
      expect(getStreak(updated)).toBe(1);
    });

    it('counts consecutive days from today', () => {
      const habit = addHabit('Exercise');
      toggleDay(habit.id, '2025-06-13');
      toggleDay(habit.id, '2025-06-14');
      toggleDay(habit.id, '2025-06-15');
      const updated = getHabits()[0];
      expect(getStreak(updated)).toBe(3);
    });

    it('breaks streak on gap before today', () => {
      const habit = addHabit('Meditate');
      toggleDay(habit.id, '2025-06-13');
      toggleDay(habit.id, '2025-06-14');
      // gap: today (2025-06-16) and yesterday (2025-06-15) not done
      const updated = getHabits()[0];
      expect(getStreak(updated, '2025-06-16')).toBe(0);
    });

    it('counts streak ending yesterday when today not done', () => {
      const habit = addHabit('Yoga');
      toggleDay(habit.id, '2025-06-13');
      toggleDay(habit.id, '2025-06-14');
      // today (2025-06-15) not done, streak counts back from yesterday
      const updated = getHabits()[0];
      expect(getStreak(updated, '2025-06-15')).toBe(2);
    });

    it('handles custom today parameter', () => {
      const habit = addHabit('Run');
      toggleDay(habit.id, '2025-06-08');
      toggleDay(habit.id, '2025-06-09');
      toggleDay(habit.id, '2025-06-10');
      const updated = getHabits()[0];
      // if 'today' is 2025-06-10, streak is 3
      expect(getStreak(updated, '2025-06-10')).toBe(3);
      // 'today' 2025-06-11 not done: streak counts back from yesterday
      expect(getStreak(updated, '2025-06-11')).toBe(3);
      // 'today' 2025-06-12: gap of a full day, streak is 0
      expect(getStreak(updated, '2025-06-12')).toBe(0);
    });

    it('counts streak of 1 when only yesterday done and today not', () => {
      const habit = addHabit('Read');
      toggleDay(habit.id, '2025-06-14');
      const updated = getHabits()[0];
      expect(getStreak(updated)).toBe(1);
    });

    it('long consecutive streak', () => {
      const habit = addHabit('Drink Water');
      for (let i = 0; i < 30; i++) {
        const date = new Date('2025-05-17');
        date.setDate(date.getDate() + i);
        const dateStr = todayKey(date);
        toggleDay(habit.id, dateStr);
      }
      const updated = getHabits()[0];
      expect(getStreak(updated)).toBe(30);
    });

    it('streak resets after a gap', () => {
      const habit = addHabit('Sleep');
      toggleDay(habit.id, '2025-06-10');
      toggleDay(habit.id, '2025-06-11');
      // gap on 2025-06-12
      toggleDay(habit.id, '2025-06-13');
      toggleDay(habit.id, '2025-06-14');
      const updated = getHabits()[0];
      // only counts from 2025-06-13 to 2025-06-14 = 2
      expect(getStreak(updated, '2025-06-14')).toBe(2);
    });
  });

  describe('integration', () => {
    it('handles multiple habits independently', () => {
      const h1 = addHabit('Walk');
      const h2 = addHabit('Read');

      toggleDay(h1.id, '2025-06-15');
      toggleDay(h2.id, '2025-06-14');

      const habits = getHabits();
      expect(isDone(habits[0])).toBe(true);
      expect(isDone(habits[1])).toBe(false);
      expect(isDone(habits[1], '2025-06-14')).toBe(true);
    });

    it('survives delete and re-add', () => {
      const h1 = addHabit('Code');
      deleteHabit(h1.id);
      const h2 = addHabit('Code');
      expect(h2.id).not.toBe(h1.id);
      expect(getHabits()).toHaveLength(1);
    });
  });
});
