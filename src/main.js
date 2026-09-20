import { getHabits, addHabit, deleteHabit, toggleDay, isDone, getStreak, setOwner } from './store.js';
import { showPicker } from './views/picker.js';

const WHO_KEY = 'ht:who';
const NAMES = { boubacar: 'Boubacar', nawel: 'Nawel' };
let owner = null;
let closePicker = null;

const form = document.getElementById('add-form');
const input = document.getElementById('habit-name');
const errorEl = document.getElementById('form-error');
const list = document.getElementById('habit-list');
const empty = document.getElementById('empty');
const status = document.getElementById('status');
const pickerEl = document.getElementById('picker');
const habitsEl = document.getElementById('habits');
const title = document.getElementById('who-title');

function announce(msg) {
  status.textContent = '';
  setTimeout(() => { status.textContent = msg; }, 20);
}

function streakText(n) {
  return n === 1 ? '1 day streak' : `${n} day streak`;
}

function render() {
  const habits = getHabits();
  list.textContent = '';
  empty.hidden = habits.length > 0;
  for (const h of habits) {
    const li = document.createElement('li');
    li.className = 'habit';

    const id = `habit-${h.id}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = isDone(h);
    cb.addEventListener('change', () => {
      const done = toggleDay(h.id);
      render();
      announce(`${h.name} marked ${done ? 'done' : 'not done'} for today`);
      const again = document.getElementById(id);
      if (again) again.focus();
    });

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = h.name;

    const streak = document.createElement('span');
    streak.className = 'streak';
    streak.textContent = streakText(getStreak(h));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Delete ${h.name}`);
    del.addEventListener('click', () => {
      deleteHabit(h.id);
      render();
      announce(`${h.name} deleted`);
      input.focus();
    });

    li.append(cb, label, streak, del);
    list.append(li);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  input.removeAttribute('aria-invalid');
  try {
    const h = addHabit(input.value);
    input.value = '';
    render();
    announce(`${h.name} added`);
  } catch (err) {
    errorEl.textContent = err.message || 'Could not add habit';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
});

function showHabits(who) {
  owner = who;
  setOwner(who);
  try { localStorage.setItem(WHO_KEY, who); } catch { /* private mode */ }
  document.body.classList.remove('picking');
  pickerEl.hidden = true;
  habitsEl.hidden = false;
  title.textContent = `${NAMES[who]}'s habits`;
  document.title = `${NAMES[who]}'s habits`;
  render();
  title.setAttribute('tabindex', '-1');
  title.focus();
}

function showCharacterSelect(moveFocus = false) {
  owner = null;
  try { localStorage.removeItem(WHO_KEY); } catch { /* private mode */ }
  habitsEl.hidden = true;
  pickerEl.hidden = false;
  document.body.classList.add('picking');
  document.title = 'Habit Tracker';
  if (closePicker) closePicker();
  closePicker = showPicker(pickerEl, showHabits);
  if (moveFocus) pickerEl.querySelector('.char-card')?.focus();
}

document.getElementById('switch').addEventListener('click', () => showCharacterSelect(true));

let saved = null;
try { saved = localStorage.getItem(WHO_KEY); } catch { /* private mode */ }
if (saved && NAMES[saved]) showHabits(saved);
else showCharacterSelect();

// Refresh "today" state if the tab was left open across midnight.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && owner) render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
