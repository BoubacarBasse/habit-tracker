# Habit Tracker - Spec (vanilla JS + Vite, localStorage, PWA)

## File ownership (agents must ONLY edit their own files)
- Agent LOGIC:  src/store.js
- Agent UI:     index.html, src/main.js, src/style.css
- Agent DOCS/TEST: tests/store.test.js, README.md, public/manifest.webmanifest, public/icon.svg, public/sw.js

## store.js contract (ES module, named exports, no DOM access except localStorage)
Storage key: "habit-tracker:v1". Data: { habits: [{ id, name, createdAt, days: ["YYYY-MM-DD", ...] }] }
- getHabits() -> Habit[]                        (returns [] if storage empty/corrupt)
- addHabit(name: string) -> Habit               (trims; throws Error on empty/whitespace name; max 60 chars)
- deleteHabit(id: string) -> void
- toggleDay(id: string, date?: string) -> boolean   (date defaults to today local YYYY-MM-DD; returns true if now done)
- isDone(habit, date?: string) -> boolean
- getStreak(habit, today?: string) -> number    (consecutive days ending today; if today not done, count ending yesterday)
- todayKey(now?: Date) -> string                (local-time YYYY-MM-DD)

## UI requirements
- Single page: title, add-habit form, list of habits with checkbox for today, streak count, delete button.
- Empty state message. Accessible (labels, focus styles, aria-live for changes). Responsive, works at 360px, dark mode via prefers-color-scheme.
- Never use innerHTML with user text (use textContent).
- index.html: meta description, theme-color, <link rel="manifest" href="/manifest.webmanifest">, favicon /icon.svg; register /sw.js in main.js.

## Docs/Test
- Vitest tests for every store.js export incl. streak edge cases (gap, today-not-done, empty, corrupt storage).
- sw.js: simple cache-first for app shell. manifest: name, short_name, icons (icon.svg), display standalone.
- README: what it is, run/test/build commands, Netlify deploy notes.
