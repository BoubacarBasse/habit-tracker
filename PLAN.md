# Habit Tracker v2 - Boubacar & Nawel (PLAN, owned by Planner)

## Goal
Two people open one link, tap their character (Boubacar or Nawel), and land on their own habit list.
They can also see each other's habits/streaks (read-only) and nudge each other. Mobile first. Deployed on Netlify.

## Decisions (final, from the user)
- NO login. Profile = a character tap; choice remembered in localStorage key "ht:who".
- Shared data lives in Supabase (Postgres). Client uses the public anon key only.
- Anyone with the URL could edit either profile. Accepted by the user. Mitigate in the DB (see docs/agents/data-security.md): fixed owner values, length limits, no delete-all. Do not store anything sensitive.
- Character images: supplied by the user later in public/characters/. Tap or swipe over the image plays a small animation. Until supplied, use placeholder initials.
- Stack stays Vite + vanilla JS. Add only @supabase/supabase-js.

## Data model (owned by data-security)
- habits(id uuid pk, owner text check in ('boubacar','nawel'), name text 1..60 chars, created_at timestamptz)
- checkins(habit_id uuid fk on delete cascade, day date, primary key(habit_id, day))
- nudges(id uuid pk, from_owner text, to_owner text, habit_id uuid null, created_at timestamptz, read boolean default false)

## Contract between logic and UI (owned by logic; UI must code against exactly this)
Owner = 'boubacar' | 'nawel'. Dates are local 'YYYY-MM-DD'.
src/store.js (all async, named exports):
- listHabits(owner) -> Habit[]   Habit = { id, owner, name, createdAt, days: string[] }  (days = check-ins, last 90 days)
- addHabit(owner, name) -> Habit          (trim, 1..60 chars, throws Error with a friendly message)
- deleteHabit(id) -> void
- toggleDay(habitId, date?) -> boolean    (date defaults to today; true = now done)
- sendNudge(from, to, habitId?) -> void
- listNudges(owner) -> Nudge[]            (unread ones sent TO owner)
- markNudgesRead(owner) -> void
src/streaks.js (pure, sync): todayKey(now?), isDone(habit, date?), getStreak(habit, today?)  (same semantics as v1)
Errors: functions throw Error with a user-readable message; network failure message: "Can't reach the server. Check your connection."
src/supabaseClient.js (owned by structure): exports `supabase`, reads import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

## File ownership (edit ONLY your own files; all chats share one folder on main)
- code chat (structure + logic): package.json, vite.config.js, netlify.toml, .env.example, .gitignore, src/supabaseClient.js, src/store.js, src/streaks.js, public/sw.js, public/manifest.webmanifest, README.md, tests/*
- data-security chat (starts later): supabase/migrations/*, docs/DATA.md
- ux chat:        index.html, src/main.js, src/views/*, src/style.css, public/characters/*, public/icon.svg
- planner (this chat): PLAN.md, BOARD.md, docs/agents/*, pushing to GitHub, Netlify env vars
- reviewer (Wave 3, read-only)

## Waves
Wave 1 (parallel): code chat, ux chat. Coordinate through BOARD.md. Code builds against a fake client, UX against a fake store.
Wave 1b: data-security chat (opened by Boubacar when ready) builds the schema and access rules from the data model and code's requests.
Wave 2: planner integration check (build + tests), Netlify env vars, push.
Wave 3: reviewer (read-only), fixes by the owning chat, deploy.

## Screens (ux)
1. Picker: two large character cards. Tap = go to that profile. Small animation on tap / swipe over the image.
2. My habits: same as v1 (add, tick today, streak, delete) + unread nudge banner.
3. Partner: read-only list of the other person's habits with today's status and streak, plus a "Nudge" button.
4. Bottom tab bar: Me | Partner | Switch person. Works at 360px, dark mode, 44px tap targets.
