// Pure date and streak helpers. Dates are local 'YYYY-MM-DD' strings.

export const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday ... 6 = Saturday

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

export function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// `habit.schedule` lists the weekdays the habit applies to. A habit without one is every day.
export function isScheduled(habit, date = todayKey()) {
  const schedule = habit && Array.isArray(habit.schedule) && habit.schedule.length ? habit.schedule : ALL_WEEK;
  return schedule.includes(weekdayOf(date));
}

// `habit.days` holds the days the habit counts as done. For a shared habit that is the days
// BOTH people checked it (the store computes this).
export function isDone(habit, date = todayKey()) {
  return !!habit && Array.isArray(habit.days) && habit.days.includes(date);
}

const MAX_STEPS = 800; // safety cap: about two years of walking back

// Consecutive SCHEDULED days that were done, ending today. Days the habit is not scheduled are
// skipped: they neither break nor add to the streak (a check-in on one is a bonus and is not
// counted). If today is scheduled but not done yet, the streak ending before today still counts.
export function getStreak(habit, today = todayKey()) {
  if (!habit || !Array.isArray(habit.days)) return 0;
  const done = new Set(habit.days);
  let cursor = today;
  let count = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (isScheduled(habit, cursor)) {
      if (done.has(cursor)) count++;
      else if (cursor !== today) break; // a missed scheduled day ends the streak
    }
    cursor = shift(cursor, -1);
  }
  return count;
}
