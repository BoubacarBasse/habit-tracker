// Month calendar: pure helpers plus the grid renderer. Dates are local 'YYYY-MM-DD' strings.
import { shift, todayKey, isScheduled, weekdayOf } from '../streaks.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const monthStart = (key) => `${key.slice(0, 7)}-01`;

export function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  return todayKey(new Date(y, m - 1 + delta, 1));
}

function parts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const monthLabel = (key) => parts(monthStart(key)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const dayLabel = (key) => parts(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

// Every cell of the month grid, Sunday first, padded with days of the neighbouring months.
export function monthGrid(monthKey) {
  const first = monthStart(monthKey);
  const [y, m] = first.split('-').map(Number);
  const length = new Date(y, m, 0).getDate();
  const lead = weekdayOf(first);
  const start = shift(first, -lead);
  const cells = [];
  for (let i = 0; i < Math.ceil((lead + length) / 7) * 7; i++) {
    const key = shift(start, i);
    cells.push({ key, inMonth: key.startsWith(first.slice(0, 7)) });
  }
  return cells;
}

// A habit shows up on the days it is scheduled, starting the day it was created.
export function startedOn(habit) {
  return habit.createdAt ? todayKey(new Date(habit.createdAt)) : '0000-00-00';
}

export function appliesOn(habit, day) {
  return day >= startedOn(habit) && isScheduled(habit, day);
}

// What is planned on `day`: shared habits, my habits and my partner's habits.
export function dayItems(board, day) {
  const on = (list) => list.filter((h) => appliesOn(h, day));
  return { shared: on(board.shared), mine: on(board.mine), theirs: on(board.theirs) };
}

// How many of `who`'s items (their own plus the shared ones) are planned on `day`, and how many are checked.
export function marker(board, who, day) {
  const items = dayItems(board, day);
  const list = [...(who === board.me ? items.mine : items.theirs), ...items.shared];
  return { total: list.length, done: list.filter((h) => h.doneBy[who].includes(day)).length };
}

function markEl(kind, m, label) {
  const s = document.createElement('span');
  s.className = `mk mk-${kind}`;
  if (m.total) {
    s.textContent = String(m.total);
    if (m.done === m.total) s.classList.add('is-done');
    else if (m.done > 0) s.classList.add('is-part');
  }
  s.dataset.label = m.total ? `${label}: ${m.done} of ${m.total} done` : '';
  return s;
}

// Draws the month into `container`. Cells are buttons; `onSelect(dayKey)` fires on tap.
export function renderMonth(container, { board, month, selected, today, names, onSelect }) {
  container.textContent = '';
  container.className = 'cal-grid';
  for (const d of DOW) {
    const h = document.createElement('span');
    h.className = 'cal-dow';
    h.setAttribute('aria-hidden', 'true');
    h.textContent = d;
    container.append(h);
  }
  for (const { key, inMonth } of monthGrid(month)) {
    const me = markEl('me', marker(board, board.me, key), names.me);
    const them = markEl('them', marker(board, board.partner, key), names.them);
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `cd-${key}`;
    b.className = 'cal-day';
    if (!inMonth) b.classList.add('out');
    if (key === today) b.classList.add('is-today');
    if (key === selected) b.classList.add('is-selected');
    b.setAttribute('aria-pressed', key === selected ? 'true' : 'false');
    const num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = String(Number(key.slice(8)));
    const marks = document.createElement('span');
    marks.className = 'cal-marks';
    marks.append(me, them);
    b.append(num, marks);
    const said = [me.dataset.label, them.dataset.label].filter(Boolean).join('; ');
    b.setAttribute('aria-label', `${dayLabel(key)}${key === today ? ', today' : ''}. ${said || 'Nothing planned.'}`);
    b.addEventListener('click', () => onSelect(key));
    container.append(b);
  }
}
