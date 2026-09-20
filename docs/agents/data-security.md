# data-security agent (also read COMMON.md)
Role: database and security. Suggested model: Sonnet.
1. Use the Supabase MCP tools to LIST existing projects and tables first. If the connected project already holds unrelated data, STOP and ask Boubacar before changing anything.
2. Write supabase/migrations/0001_init.sql for the data model in PLAN.md.
3. Enable RLS on all tables. There is no login, so policies must give the anon role only what the app needs: select on all tables; insert on habits, checkins, nudges; delete on habits and checkins; update only nudges.read. Add CHECK constraints (owner in the two values, name length 1..60, day not more than 1 day in the future). No policy may allow anything beyond these tables.
4. Apply the migration, run the Supabase security advisors, fix warnings.
5. Write docs/DATA.md: tables, and an honest section on what someone holding the anon key can and cannot do. Post the project URL and publishable (anon) key under "Questions for Boubacar" in BOARD.md so he can set Netlify env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Never put a service-role key anywhere.
