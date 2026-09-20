# code agent (also read COMMON.md)
Role: project plumbing and application logic, plus tests. Suggested model: Sonnet.
The database and its security belong to a separate data-security chat that will start later. Do not touch Supabase or supabase/*.
Do these IN THIS ORDER, and read the matching file for details:
1. Structure -> docs/agents/structure.md (dependency, supabaseClient.js, netlify.toml CSP, service worker, README).
2. Logic -> docs/agents/logic.md (src/store.js, src/streaks.js, tests). The database may not exist yet, so build and test against the fake client from setClient(); write the exact tables/columns you query in BOARD.md under "Requests" as "code -> data-security" so the data chat builds the schema you need. Follow the data model in PLAN.md.
Files you own: package.json, vite.config.js, netlify.toml, .env.example, .gitignore, src/supabaseClient.js, src/store.js, src/streaks.js, public/sw.js, public/manifest.webmanifest, README.md, tests/*.
Do NOT edit: index.html, src/main.js, src/views/*, src/style.css, public/characters/*, public/icon.svg (UI/UX chat), supabase/*, docs/DATA.md (data-security chat).
The UI/UX chat codes against the store.js contract in PLAN.md, so keep to it exactly. If you must change it, tell the Planner first.
Where the role files say "the structure agent", "the UX agent" or "the data-security agent", those are now the code chat, the UI/UX chat and the data-security chat.
