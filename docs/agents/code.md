# code agent (also read COMMON.md)
Role: everything behind the screens: database, project plumbing, app logic, tests. Suggested model: Sonnet.
You own the files of three earlier roles. Do them IN THIS ORDER, and read the matching file for the details of each:
1. Data + security -> docs/agents/data-security.md (Supabase schema, access rules, docs/DATA.md). STOP and ask Boubacar before touching any Supabase project that already holds unrelated data, and before applying a migration to a remote project.
2. Structure -> docs/agents/structure.md (dependency, supabaseClient.js, netlify.toml CSP, service worker, README).
3. Logic -> docs/agents/logic.md (src/store.js, src/streaks.js, tests).
Files you own: supabase/migrations/*, docs/DATA.md, package.json, vite.config.js, netlify.toml, .env.example, .gitignore, src/supabaseClient.js, src/store.js, src/streaks.js, public/sw.js, public/manifest.webmanifest, README.md, tests/*.
Do NOT edit: index.html, src/main.js, src/views/*, src/style.css, public/characters/*, public/icon.svg (UI/UX chat owns them). The UI/UX chat codes against the store.js contract in PLAN.md, so keep to it exactly, and if you must change it, tell the Planner first.
Where those role files say "the structure agent" or "the UX agent", that is now the code chat and the UI/UX chat.
