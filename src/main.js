import {
  NAMES, partnerOf, loadBoard, addHabit, deleteHabit, setChecked, applyCheck, setHabitDays,
  sendNudge, listNudges, markNudgesRead,
} from './store.js';
import { todayKey, shift, getStreak, isScheduled, ALL_WEEK } from './streaks.js';
import { showPicker } from './views/picker.js';
import { drawSprite } from './views/characters.js';
import { renderMonth, dayItems, monthStart, addMonths, monthLabel, dayLabel } from './views/calendar.js';

const WHO_KEY = 'ht:who';
const REFRESH_MS = 30000;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SPRITES = { boubacar: 'man', nawel: 'woman' };
const EDIT_BACK_DAYS = 7; // the database only accepts check-ins this far back
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
let tab = 'me'; // 'me' | 'shared' | 'calendar' | 'partner'
let calMonth = monthStart(todayKey());
let calDay = todayKey();
let editingId = null; // habit whose weekdays are being edited
let enter = true; // play the entrance animation on the next paint of real data
const lastFrac = {}; // progress-ring position per tab, so the ring animates from where it was
let offOpen = false; // is "Not scheduled today" expanded
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
async function toggle(habit, checked, day = todayKey()) {
  replaceHabit(applyCheck(habit, me, day, checked));
  renderList();
  if (checked) document.getElementById(`hc-${habit.id}`)?.closest('.habit')?.classList.add('just-done');
  announce(`${habit.name} ${checked ? 'checked' : 'unchecked'} for ${day === todayKey() ? 'today' : dayLabel(day)}`);
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

async function changeDays(habit, days) {
  try {
    await setHabitDays(habit.id, days);
    editingId = null;
    replaceHabit({ ...habit, schedule: days });
    renderList();
    announce(`${habit.name} days changed`);
  } catch (e) {
    showError(e.message);
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

const canEdit = (day) => day <= todayKey() && day >= shift(todayKey(), -EDIT_BACK_DAYS);

function checkbox(habit, day) {
  const cb = el('input');
  cb.type = 'checkbox';
  cb.id = `hc-${habit.id}`;
  cb.checked = habit.doneBy[me].includes(day);
  cb.disabled = !canEdit(day);
  cb.addEventListener('change', () => toggle(habit, cb.checked, day));
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

function scheduleText(days) {
  const sorted = [...days].sort();
  const key = sorted.join('');
  if (key === '0123456') return 'Every day';
  if (key === '12345') return 'Weekdays';
  if (key === '06') return 'Weekends';
  return sorted.map((d) => DAY_SHORT[d]).join(' ');
}

// Seven weekday toggles. get() returns the chosen weekdays (0 = Sunday).
function dayChips(selected) {
  const wrap = el('div', 'days');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Days of the week');
  const boxes = DAY_LETTERS.map((letter, i) => {
    const lab = el('label', 'day');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = selected.includes(i);
    cb.setAttribute('aria-label', DAY_NAMES[i]);
    lab.append(cb, el('span', null, letter));
    wrap.append(lab);
    return cb;
  });
  return {
    el: wrap,
    get: () => boxes.flatMap((b, i) => (b.checked ? [i] : [])),
    set: (days) => boxes.forEach((b, i) => { b.checked = days.includes(i); }),
  };
}

function dayEditor(habit) {
  const box = el('div', 'day-editor');
  const chips = dayChips(habit.schedule);
  const save = el('button', null, 'Save days');
  save.type = 'button';
  const cancel = el('button', 'ghost', 'Cancel');
  cancel.type = 'button';
  const error = el('p', 'error');
  error.setAttribute('role', 'alert');
  save.addEventListener('click', () => {
    const days = chips.get();
    if (!days.length) { error.textContent = 'Pick at least one day.'; return; }
    changeDays(habit, days);
  });
  cancel.addEventListener('click', () => { editingId = null; renderList(); });
  const actions = el('div', 'row');
  actions.append(save, cancel);
  box.append(chips.el, actions, error);
  return box;
}

function streakEl(habit) {
  const n = getStreak(habit);
  return el('span', 'streak' + (n > 0 ? ' hot' : ''), streakText(n));
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// Summary card: a progress ring plus a short line. The ring animates from its last position.
function heroCard(key, done, total, title, sub) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const frac = total ? done / total : 0;
  const prev = lastFrac[key] ?? 0;
  lastFrac[key] = frac;
  const box = el('div', 'hero');
  const ring = el('div', 'ring');
  const svg = svgEl('svg', { viewBox: '0 0 110 110', 'aria-hidden': 'true' });
  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id: 'ringGrad', x1: '0', y1: '0', x2: '1', y2: '1' });
  grad.append(svgEl('stop', { offset: '0', 'stop-color': '#3b82f6' }), svgEl('stop', { offset: '1', 'stop-color': '#ff5c6c' }));
  defs.append(grad);
  const bg = svgEl('circle', { class: 'ring-bg', cx: '55', cy: '55', r: String(R) });
  const fg = svgEl('circle', { class: 'ring-fg', cx: '55', cy: '55', r: String(R), stroke: 'url(#ringGrad)' });
  fg.setAttribute('stroke-dasharray', String(C));
  fg.style.strokeDashoffset = String(C * (1 - prev));
  svg.append(defs, bg, fg);
  ring.append(svg, el('span', 'ring-num', `${Math.round(frac * 100)}%`));
  const text = el('div', 'hero-text');
  text.append(el('p', 'hero-title', title), el('p', 'hero-sub', sub));
  box.append(ring, text);
  requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = String(C * (1 - frac)); }));
  return box;
}

function chipText(done, day, today, due) {
  if (!due) return done ? 'Done (bonus)' : 'Off today';
  if (done) return day === today ? 'Done today' : 'Done';
  if (day > today) return 'Planned';
  return day === today ? 'Not yet' : 'Missed';
}

// One habit row. `day` is the day being shown; `compact` (calendar day list) drops the extras.
function row(habit, kind, day = todayKey(), compact = false) {
  const today = todayKey();
  const partner = partnerOf(me);
  const due = isScheduled(habit, day);
  const li = el('li', 'habit');

  if (kind === 'theirs') {
    const done = habit.doneBy[partner].includes(day);
    li.classList.toggle('is-done', done);
    li.append(el('span', 'habit-name', habit.name));
    if (!compact) {
      li.append(streakEl(habit));
      if (habit.schedule.length < 7) li.append(el('span', 'sched-note', scheduleText(habit.schedule)));
    }
    li.append(el('span', 'chip' + (done ? ' chip-done' : ''), chipText(done, day, today, due)));
    if (!done && due && day === today) li.append(nudgeButton(habit));
    return li;
  }

  const cb = checkbox(habit, day);
  const label = el('label', 'habit-name', habit.name);
  label.htmlFor = cb.id;
  li.append(cb, label);
  if (!compact) li.append(streakEl(habit));

  const mineDone = habit.doneBy[me].includes(day);
  const actions = el('div', 'actions');
  if (kind === 'shared') {
    const theirDone = habit.doneBy[partner].includes(day);
    li.classList.toggle('is-done', mineDone && theirDone);
    const status = el('span', 'chip' + (mineDone && theirDone ? ' chip-done' : ''));
    status.textContent = mineDone && theirDone
      ? 'Done together'
      : `You: ${mineDone ? 'done' : 'not yet'} · ${partnerName()}: ${theirDone ? 'done' : 'not yet'}`;
    li.append(status);
    if (!theirDone && due && day === today) actions.append(nudgeButton(habit));
  } else {
    li.classList.toggle('is-done', mineDone);
  }

  if (!compact) {
    const sched = el('button', 'ghost sched', scheduleText(habit.schedule));
    sched.type = 'button';
    sched.id = `sc-${habit.id}`;
    sched.setAttribute('aria-label', `Change days for ${habit.name}. Now: ${scheduleText(habit.schedule)}`);
    sched.setAttribute('aria-expanded', editingId === habit.id ? 'true' : 'false');
    sched.addEventListener('click', () => { editingId = editingId === habit.id ? null : habit.id; renderList(); });
    actions.append(sched, deleteButton(habit));
  }
  if (actions.children.length) li.append(actions);
  if (!compact && editingId === habit.id) li.append(dayEditor(habit));
  return li;
}

function renderHabits(kind) {
  const habits = tab === 'me' ? board.mine : tab === 'shared' ? board.shared : board.theirs;
  const today = todayKey();
  if (!habits.length) {
    const msg = {
      me: 'No habits yet. Add your first one above.',
      shared: 'No shared habits yet. Add one above. It only counts as done when you both check it.',
      partner: `${partnerName()} has no habits yet.`,
    }[tab];
    listEl.append(el('p', 'empty', msg));
    return;
  }
  const due = habits.filter((h) => isScheduled(h, today));
  const off = habits.filter((h) => !isScheduled(h, today));
  if (due.length) {
    const doneNow = (h) => (kind === 'theirs' ? h.doneBy[partnerOf(me)].includes(today)
      : kind === 'shared' ? h.doneBy.boubacar.includes(today) && h.doneBy.nawel.includes(today)
        : h.doneBy[me].includes(today));
    const done = due.filter(doneNow).length;
    const who = kind === 'theirs' ? `${partnerName()} has` : 'You have';
    const title = done === due.length ? 'All done' : `${done} of ${due.length} done`;
    const sub = done === due.length
      ? (kind === 'shared' ? 'Done together. Nice work.' : 'Nice work today.')
      : done === 0 ? `${who} ${due.length} to go today.` : 'Keep going, you are on a roll.';
    listEl.append(heroCard(tab, done, due.length, title, sub));
    const ul = el('ul', 'habit-list');
    for (const h of due) ul.append(row(h, kind));
    listEl.append(ul);
  } else {
    listEl.append(el('p', 'empty', 'Nothing scheduled for today.'));
  }
  if (off.length) {
    const details = el('details', 'off-today');
    details.open = offOpen;
    details.addEventListener('toggle', () => { offOpen = details.open; });
    details.append(el('summary', null, `Not scheduled today (${off.length})`));
    const ul = el('ul', 'habit-list');
    for (const h of off) ul.append(row(h, kind));
    details.append(ul);
    listEl.append(details);
  }
}

function dayPanel(day) {
  const today = todayKey();
  const items = dayItems(board, day);
  const box = el('section', 'day-panel');
  box.append(el('h3', null, `${dayLabel(day)}${day === today ? ' · Today' : ''}`));
  const groups = [
    ['Shared', items.shared, 'shared'],
    ['You', items.mine, 'mine'],
    [partnerName(), items.theirs, 'theirs'],
  ];
  let any = false;
  for (const [name, list, kind] of groups) {
    if (!list.length) continue;
    any = true;
    box.append(el('h4', null, name));
    const ul = el('ul', 'habit-list');
    for (const h of list) ul.append(row(h, kind, day, true));
    box.append(ul);
  }
  if (!any) box.append(el('p', 'empty', 'Nothing planned this day.'));
  else if (day > today) box.append(el('p', 'empty', 'You can check things off on the day itself.'));
  else if (!canEdit(day)) box.append(el('p', 'empty', `Check-ins can only be changed for the last ${EDIT_BACK_DAYS} days.`));
  return box;
}

function renderCalendar() {
  const today = todayKey();
  const head = el('div', 'cal-head');
  const prev = el('button', 'ghost', '‹');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous month');
  prev.addEventListener('click', () => { calMonth = addMonths(calMonth, -1); renderList(); });
  const next = el('button', 'ghost', '›');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next month');
  next.addEventListener('click', () => { calMonth = addMonths(calMonth, 1); renderList(); });
  const label = el('h2', 'cal-title', monthLabel(calMonth));
  const now = el('button', 'ghost', 'Today');
  now.type = 'button';
  now.addEventListener('click', () => { calMonth = monthStart(today); calDay = today; renderList(); });
  head.append(prev, label, next, now);

  const grid = el('div');
  renderMonth(grid, {
    board, month: calMonth, selected: calDay, today,
    names: { me: 'You', them: partnerName() },
    onSelect: (key) => {
      calDay = key;
      calMonth = monthStart(key);
      renderList();
    },
  });

  const legend = el('p', 'cal-legend');
  legend.append(
    el('span', 'mk mk-me is-done', 'You'), ' ',
    el('span', 'mk mk-them is-done', partnerName()),
    ' number = items planned · filled = all done',
  );
  listEl.append(head, grid, legend, dayPanel(calDay));
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
  if (enter) {
    enter = false;
    const target = listEl;
    target.classList.add('enter');
    setTimeout(() => target.classList.remove('enter'), 1000);
  }
  if (tab === 'calendar') renderCalendar();
  else renderHabits(tab === 'me' ? 'mine' : tab === 'shared' ? 'shared' : 'theirs');
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

  const chips = dayChips(ALL_WEEK);
  const quick = el('div', 'quick');
  for (const [text, days] of [['Every day', ALL_WEEK], ['Weekdays', [1, 2, 3, 4, 5]]]) {
    const q = el('button', 'ghost', text);
    q.type = 'button';
    q.addEventListener('click', () => chips.set(days));
    quick.append(q);
  }
  const daysRow = el('div', 'days-row');
  daysRow.append(el('span', 'days-label', 'Repeats on'), chips.el, quick);
  form.append(label, inputRow, daysRow, error);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    add.disabled = true;
    try {
      const habit = await addHabit(shared ? 'both' : me, input.value, chips.get());
      input.value = '';
      form.closest('details')?.removeAttribute('open');
      if (!isScheduled(habit, todayKey())) offOpen = true; // so a habit added for other days is not hidden
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

// Collapsed by default so the form stays out of the way at the bottom of the list.
function buildAdd() {
  const box = el('details', 'add-habit');
  box.append(el('summary', null, tab === 'shared' ? '+ Add shared habit' : '+ Add habit'), buildForm());
  box.addEventListener('toggle', () => { if (box.open) box.querySelector('#habit-name')?.focus(); });
  return box;
}

function renderTab() {
  enter = true;
  view.textContent = '';
  for (const b of tabbar.querySelectorAll('[data-tab]')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const heading = {
    me: 'Today',
    shared: 'Shared habits',
    calendar: 'Calendar',
    partner: `${partnerName()}'s habits`,
  }[tab];
  const h2 = el('h2', null, heading);
  listEl = el('div', 'list');
  if (tab === 'partner') view.append(h2, listEl);
  else if (tab === 'calendar') view.append(listEl);
  else view.append(h2, listEl, buildAdd());
  renderList();
}

// ---------------------------------------------------------------- screens
function showHabits(who) {
  me = who;
  board = null;
  nudges = [];
  tab = 'me';
  calMonth = monthStart(todayKey());
  calDay = todayKey();
  editingId = null;
  try { localStorage.setItem(WHO_KEY, who); } catch { /* private mode */ }
  document.body.classList.remove('picking');
  pickerEl.hidden = true;
  appEl.hidden = false;
  title.textContent = `${NAMES[who]}'s habits`;
  document.title = `${NAMES[who]}'s habits`;
  $('partner-tab').querySelector('.tab-label').textContent = partnerName();
  const hour = new Date().getHours();
  $('hello').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  drawSprite($('avatar'), SPRITES[who], 0);
  for (const k of Object.keys(lastFrac)) delete lastFrac[k];
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
    editingId = null;
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
