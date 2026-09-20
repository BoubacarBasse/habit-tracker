const KEY = 'habit-tracker:v1';
const MAX_NAME = 60;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data || !Array.isArray(data.habits)) return [];
    return data.habits
      .filter((h) => h && typeof h === 'object' && typeof h.id === 'string' && typeof h.name === 'string')
      .map((h) => ({
        id: h.id,
        name: h.name,
        createdAt: h.createdAt,
        days: Array.isArray(h.days) ? h.days.filter((d) => typeof d === 'string') : [],
      }));
  } catch {
    return [];
  }
}

function save(habits) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ habits }));
  } catch {
    /* storage unavailable or full */
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getHabits() {
  return load();
}

export function addHabit(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new Error('Habit name cannot be empty');
  if (trimmed.length > MAX_NAME) throw new Error(`Habit name must be at most ${MAX_NAME} characters`);
  const habit = { id: newId(), name: trimmed, createdAt: new Date().toISOString(), days: [] };
  const habits = load();
  habits.push(habit);
  save(habits);
  return habit;
}

export function deleteHabit(id) {
  save(load().filter((h) => h.id !== id));
}

export function toggleDay(id, date = todayKey()) {
  const habits = load();
  const habit = habits.find((h) => h.id === id);
  if (!habit) return false;
  const i = habit.days.indexOf(date);
  let done;
  if (i === -1) {
    habit.days.push(date);
    habit.days.sort();
    done = true;
  } else {
    habit.days.splice(i, 1);
    done = false;
  }
  save(habits);
  return done;
}

export function isDone(habit, date = todayKey()) {
  return !!habit && Array.isArray(habit.days) && habit.days.includes(date);
}

function shift(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + delta));
}

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
