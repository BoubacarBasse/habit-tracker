// Pure date and streak helpers. Dates are local 'YYYY-MM-DD' strings.

export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shift(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + delta));
}

// `habit.days` holds the days the habit counts as done. For a shared habit that is the days
// BOTH people checked it (the store computes this).
export function isDone(habit, date = todayKey()) {
  return !!habit && Array.isArray(habit.days) && habit.days.includes(date);
}

// Consecutive done days ending today. If today is not done yet, the streak ending yesterday
// still counts, so it is not lost while the day is still going.
export function getStreak(habit, today = todayKey()) {
  if (!habit || !Array.isArray(habit.days)) return 0;
  const set = new Set(habit.days);
  let cursor = set.has(today) ? today : shift(today, -1);
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = shift(cursor, -1);
  }
  return count;
}
