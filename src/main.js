import {
  NAMES, partnerOf, loadBoard, addHabit, deleteHabit, setChecked, applyCheck,
  sendNudge, listNudges, markNudgesRead,
} from './store.js';
import { todayKey, getStreak } from './streaks.js';
import { showPicker } from './views/picker.js';

const WHO_KEY = 'ht:who';
const REFRESH_MS = 30000;
const $ = (id) => document.getElementById(id);

const pickerEl = $('picker');
const appEl = $('app');
const title = $('who-title');
const banner = $('banner');
const nudgesEl = $('nudges');
const view = $('view');
const statusEl = $('status');
const tabbar = $('tabbar');

let me = null;
let tab = 'me'; // 'me' | 'shared' | 'partner'
let board = null; // last data from the server
let nudges = [];
let listEl = null;
let closePicker = null;
let refreshTimer = null;
let refreshing = false;

// ---------------------------------------------------------------- small helpers
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function announce(msg) {
  statusEl.textContent = '';
  setTimeout(() => { statusEl.textContent = msg; }, 20);
}

function showError(msg, retry) {
  banner.textContent = msg;
  if (retry) {
    const b = el('button', 'ghost', 'Retry');
    b.type = 'button';
    b.addEventListener('click', retry);
    banner.append(' ', b);
  }
  banner.hidden = false;
}

function clearError() {
  banner.hidden = true;
  banner.textContent = '';
}

const streakText = (n) => (n === 1 ? '1 day streak' : `${n} day streak`);
const allHabits = () => (board ? [...board.mine, ...board.theirs, ...board.shared] : []);
const findHabit = (id) => allHabits().find((h) => h.id === id);
const partnerName = () => NAMES[partnerOf(me)];

function replaceHabit(next) {
  for (const key of ['mine', 'theirs', 'shared']) {
    board[key] = board[key].map((h) => (h.id === next.id ? next : h));
  }
}

function removeHabit(id) {
  for (const key of ['mine', 'theirs', 'shared']) board[key] = board[key].filter((h) => h.id !== id);
}

// ---------------------------------------------------------------- loading
async function refresh() {
  if (!me || refreshing) return;
  refreshing = true;
  const who = me;
  try {
    const [b, n] = await Promise.all([loadBoard(who), listNudges(who)]);
    if (me !== who) return;
    board = b;
    nudges = n;
    clearError();
    renderNudges();
    renderList();
  } catch (e) {
    if (me === who) showError(e.message, refresh);
  } finally {
    refreshing = false;
  }
}

// ---------------------------------------------------------------- actions
async function toggle(habit, checked) {
  const day = todayKey();
  replaceHabit(applyCheck(habit, me, day, checked));
  renderList();
  announce(`${habit.name} ${checked ? 'checked' : 'unchecked'} for today`);
  try {
    await setChecked(habit.id, me, checked, day);
  } catch (e) {
    const current = findHabit(habit.id);
    if (current) replaceHabit(applyCheck(current, me, day, !checked));
    renderList();
    showError(e.message);
  }
}

async function remove(habit) {
  const extra = habit.shared ? ` It will disappear for ${partnerName()} too.` : '';
  if (!window.confirm(`Delete "${habit.name}"? Its streak history will be lost.${extra}`)) return;
  removeHabit(habit.id);
  renderList();
  announce(`${habit.name} deleted`);
  try {
    await deleteHabit(habit.id);
  } catch (e) {
    showError(e.message);
    refresh();
  }
}

async function nudge(habit, btn) {
  btn.disabled = true;
  try {
    await sendNudge(me, partnerOf(me), habit.id);
    btn.textContent = 'Nudged';
    announce(`Nudge sent to ${partnerName()}`);
  } catch (e) {
    btn.disabled = false;
    showError(e.message);
  }
}

async function dismissNudges() {
  nudges = [];
  renderNudges();
  try {
    await markNudgesRead(me);
  } catch (e) {
    showError(e.message);
  }
}

// ---------------------------------------------------------------- rendering
function renderNudges() {
  nudgesEl.textContent = '';
  nudgesEl.hidden = nudges.length === 0;
  if (!nudges.length) return;
  for (const n of nudges) {
    const habit = findHabit(n.habit_id);
    const about = habit ? ` about "${habit.name}"` : '';
    nudgesEl.append(el('p', 'nudge', `${NAMES[n.from_owner]} nudged you${about}.`));
  }
  const b = el('button', 'ghost', 'Got it');
  b.type = 'button';
  b.addEventListener('click', dismissNudges);
  nudgesEl.append(b);
}

function checkbox(habit) {
  const cb = el('input');
  cb.type = 'checkbox';
  cb.id = `hc-${habit.id}`;
  cb.checked = habit.doneBy[me].includes(todayKey());
  cb.addEventListener('change', () => toggle(habit, cb.checked));
  return cb;
}

function deleteButton(habit) {
  const b = el('button', 'delete', 'Delete');
  b.type = 'button';
  b.id = `del-${habit.id}`;
  b.setAttribute('aria-label', `Delete ${habit.name}`);
  b.addEventListener('click', () => remove(habit));
  return b;
}

function nudgeButton(habit) {
  const b = el('button', 'ghost', 'Nudge');
  b.type = 'button';
  b.id = `nd-${habit.id}`;
  b.setAttribute('aria-label', `Nudge ${partnerName()} about ${habit.name}`);
  b.addEventListener('click', () => nudge(habit, b));
  return b;
}

function row(habit, kind) {
  const today = todayKey();
  const partner = partnerOf(me);
  const li = el('li', 'habit');

  if (kind === 'theirs') {
    const done = habit.doneBy[partner].includes(today);
    li.classList.toggle('is-done', done);
    li.append(el('span', 'habit-name', habit.name), el('span', 'streak', streakText(getStreak(habit))));
    li.append(el('span', 'chip' + (done ? ' chip-done' : ''), done ? 'Done today' : 'Not yet'));
    if (!done) li.append(nudgeButton(habit));
    return li;
  }

  const cb = checkbox(habit);
  const label = el('label', 'habit-name', habit.name);
  label.htmlFor = cb.id;
  li.append(cb, label, el('span', 'streak', streakText(getStreak(habit))));

  if (kind === 'shared') {
    const mineDone = habit.doneBy[me].includes(today);
    const theirDone = habit.doneBy[partner].includes(today);
    li.classList.toggle('is-done', mineDone && theirDone);
    const status = el('span', 'chip' + (mineDone && theirDone ? ' chip-done' : ''));
    status.textContent = mineDone && theirDone
      ? 'Done together'
      : `You: ${mineDone ? 'done' : 'not yet'} · ${partnerName()}: ${theirDone ? 'done' : 'not yet'}`;
    li.append(status);
    if (!theirDone) li.append(nudgeButton(habit));
  } else {
    li.classList.toggle('is-done', habit.doneBy[me].includes(today));
  }
  li.append(deleteButton(habit));
  return li;
}

function renderList() {
  if (!listEl) return;
  const active = document.activeElement;
  const keepFocus = active && listEl.contains(active) && active.id ? active.id : null;
  listEl.textContent = '';

  if (!board) {
    listEl.append(el('p', 'empty', 'Loading…'));
    return;
  }
  const habits = tab === 'me' ? board.mine : tab === 'shared' ? board.shared : board.theirs;
  const kind = tab === 'me' ? 'mine' : tab === 'shared' ? 'shared' : 'theirs';
  if (!habits.length) {
    const msg = {
      me: 'No habits yet. Add your first one above.',
      shared: 'No shared habits yet. Add one above. It only counts as done when you both check it.',
      partner: `${partnerName()} has no habits yet.`,
    }[tab];
    listEl.append(el('p', 'empty', msg));
  } else {
    const ul = el('ul', 'habit-list');
    for (const h of habits) ul.append(row(h, kind));
    listEl.append(ul);
  }
  if (keepFocus) document.getElementById(keepFocus)?.focus();
}

function buildForm() {
  const shared = tab === 'shared';
  const form = el('form', 'add-form');
  form.noValidate = true;
  const label = el('label', null, shared ? 'New shared habit' : 'New habit');
  label.htmlFor = 'habit-name';
  const input = el('input');
  input.id = 'habit-name';
  input.type = 'text';
  input.maxLength = 60;
  input.autocomplete = 'off';
  input.placeholder = shared ? 'e.g. Evening walk' : 'e.g. Drink water';
  const add = el('button', null, 'Add');
  add.type = 'submit';
  const inputRow = el('div', 'row');
  inputRow.append(input, add);
  const error = el('p', 'error');
  error.setAttribute('role', 'alert');
  form.append(label, inputRow, error);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    add.disabled = true;
    try {
      const habit = await addHabit(shared ? 'both' : me, input.value);
      input.value = '';
      if (board) {
        board[shared ? 'shared' : 'mine'].push(habit);
        renderList();
      } else {
        refresh();
      }
      announce(`${habit.name} added`);
    } catch (err) {
      error.textContent = err.message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    } finally {
      add.disabled = false;
    }
  });
  return form;
}

function renderTab() {
  view.textContent = '';
  for (const b of tabbar.querySelectorAll('[data-tab]')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const heading = {
    me: 'Today',
    shared: 'Shared habits',
    partner: `${partnerName()}'s habits`,
  }[tab];
  const h2 = el('h2', null, heading);
  listEl = el('div', 'list');
  if (tab === 'partner') view.append(h2, listEl);
  else view.append(buildForm(), h2, listEl);
  renderList();
}

// ---------------------------------------------------------------- screens
function showHabits(who) {
  me = who;
  board = null;
  nudges = [];
  tab = 'me';
  try { localStorage.setItem(WHO_KEY, who); } catch { /* private mode */ }
  document.body.classList.remove('picking');
  pickerEl.hidden = true;
  appEl.hidden = false;
  title.textContent = `${NAMES[who]}'s habits`;
  document.title = `${NAMES[who]}'s habits`;
  $('partner-tab').textContent = partnerName();
  clearError();
  renderNudges();
  renderTab();
  refresh();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  title.focus();
}

function showCharacterSelect(moveFocus = false) {
  me = null;
  board = null;
  clearInterval(refreshTimer);
  try { localStorage.removeItem(WHO_KEY); } catch { /* private mode */ }
  appEl.hidden = true;
  pickerEl.hidden = false;
  document.body.classList.add('picking');
  document.title = 'Habit Tracker';
  if (closePicker) closePicker();
  closePicker = showPicker(pickerEl, showHabits);
  if (moveFocus) pickerEl.querySelector('.char-card')?.focus();
}

tabbar.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'switch') { showCharacterSelect(true); return; }
  if (b.dataset.tab && b.dataset.tab !== tab) {
    tab = b.dataset.tab;
    renderTab();
  }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', refresh);

let saved = null;
try { saved = localStorage.getItem(WHO_KEY); } catch { /* private mode */ }
if (saved && NAMES[saved]) showHabits(saved);
else showCharacterSelect();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
