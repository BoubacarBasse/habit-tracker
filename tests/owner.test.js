import { describe, it, expect, beforeEach } from 'vitest';
import { setOwner, addHabit, getHabits } from '../src/store.js';

describe('per-person habit lists', () => {
  beforeEach(() => localStorage.clear());

  it('keeps each person\'s habits separate', () => {
    setOwner('boubacar');
    addHabit('Run');
    setOwner('nawel');
    expect(getHabits()).toEqual([]);
    addHabit('Read');
    setOwner('boubacar');
    expect(getHabits().map((h) => h.name)).toEqual(['Run']);
  });
});
