# Habit Tracker for two

Boubacar and Nawel each pick their character and get their own habit list. They can see each
other's habits and streaks, nudge each other, and keep **shared habits** that only count as done
for a day when *both* have checked them.

## How it works
- **Character select:** pixel-art picker (`src/views/picker.js`, `src/views/characters.js`). No login. The choice is remembered on that device (`localStorage` key `ht:who`).
- **Screens:** Me (my habits), Shared (habits you both must check), Partner (their habits, read-only, with a Nudge button), Switch.
- **Streaks:** consecutive days, resetting at local midnight. If today isn't done yet, yesterday's streak still shows. A shared habit's streak counts days *both* checked. Logic: `src/streaks.js`.
- **Data:** Supabase (Postgres) through the public anon key. Data layer: `src/store.js`. Schema and access rules: `supabase/migrations/0001_init.sql`.
- **Offline:** the app shell is cached by a service worker (`public/sw.js`), but habits need a connection.

## Security model (read this)
There is no login, so the anon key ships in the site and **anyone with the URL can read and edit
both people's habits**. The database rules limit the damage (fixed owner names, name length,
30 habits per list, check-in dates within about a week, one nudge per minute, no renames) but
cannot make the data private. Don't put anything sensitive in habit names. A strict
Content-Security-Policy is set in `netlify.toml`.

## Run it
```
npm install
cp .env.example .env.local   # then fill in the Supabase URL and anon key
npm run dev                  # http://localhost:5173
npm test
npm run build
```
Get the two values from Supabase: Project Settings, then API. Use the anon (public) key only,
never the service_role key.

## Set up the database
Run `supabase/migrations/0001_init.sql` once in Supabase (SQL Editor, New query, paste, Run).

## Deploy (Netlify)
Build command `npm run build`, publish directory `dist` (already in `netlify.toml`). Set the
environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for builds. They are read
at build time, so redeploy after changing them.
