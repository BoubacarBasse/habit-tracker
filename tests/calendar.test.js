import { describe, it, expect } from 'vitest';
import { monthGrid, addMonths, monthStart, appliesOn, dayItems, marker } from '../src/views/calendar.js';

const habit = (over) => ({ id: 'h', createdAt: '2025-06-01T12:00:00', schedule: [0, 1, 2, 3, 4, 5, 6], doneBy: { boubacar: [], nawel: [] }, days: [], ...over });

describe('monthGrid', () => {
  it('starts on a Sunday and covers whole weeks', () => {
    const cells = monthGrid('2025-06-15'); // June 2025 starts on a Sunday
    expect(cells[0]).toEqual({ key: '2025-06-01', inMonth: true });
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it('pads with days of the neighbouring months', () => {
    const cells = monthGrid('2025-07-01'); // July 2025 starts on a Tuesday
    expect(cells[0]).toEqual({ key: '2025-06-29', inMonth: false });
    expect(cells.at(-1).key).toBe('2025-08-02');
  });
});

describe('months', () => {
  it('addMonths crosses year boundaries', () => {
    expect(addMonths('2025-12-01', 1)).toBe('2026-01-01');
    expect(addMonths('2025-01-15', -1)).toBe('2024-12-01');
  });
  it('monthStart', () => expect(monthStart('2025-06-15')).toBe('2025-06-01'));
});

describe('what is planned on a day', () => {
  it('a habit applies only from the day it was created, on its weekdays', () => {
    const mwf = habit({ schedule: [1, 3, 5], createdAt: '2025-06-10T09:00:00' });
    expect(appliesOn(mwf, '2025-06-11')).toBe(true); // Wednesday after creation
    expect(appliesOn(mwf, '2025-06-12')).toBe(false); // Thursday
    expect(appliesOn(mwf, '2025-06-09')).toBe(false); // Monday before creation
  });

  const board = {
    me: 'boubacar', partner: 'nawel',
    mine: [habit({ id: 'gym', schedule: [1], doneBy: { boubacar: ['2025-06-16'], nawel: [] } })],
    theirs: [habit({ id: 'yoga', schedule: [1, 2], doneBy: { boubacar: [], nawel: [] } })],
    shared: [habit({ id: 'walk', schedule: [1], doneBy: { boubacar: ['2025-06-16'], nawel: ['2025-06-16'] } })],
  };

  it('groups items by person and shared', () => {
    const monday = dayItems(board, '2025-06-16');
    expect(monday.mine.map((h) => h.id)).toEqual(['gym']);
    expect(monday.theirs.map((h) => h.id)).toEqual(['yoga']);
    expect(monday.shared.map((h) => h.id)).toEqual(['walk']);
    const tuesday = dayItems(board, '2025-06-17');
    expect(tuesday.mine).toEqual([]);
    expect(tuesday.shared).toEqual([]);
    expect(tuesday.theirs.map((h) => h.id)).toEqual(['yoga']);
  });

  it('counts planned and done items per person, shared included', () => {
    expect(marker(board, 'boubacar', '2025-06-16')).toEqual({ total: 2, done: 2 });
    expect(marker(board, 'nawel', '2025-06-16')).toEqual({ total: 2, done: 1 });
    expect(marker(board, 'boubacar', '2025-06-18')).toEqual({ total: 0, done: 0 });
  });
});
