# structure agent (also read COMMON.md)
Role: project structure and plumbing. Suggested model: Sonnet.
1. npm install @supabase/supabase-js.
2. Create src/supabaseClient.js per PLAN.md and .env.example (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Make sure .env files are gitignored except .env.example.
3. Update netlify.toml: keep the existing headers, add a Content-Security-Policy allowing the Supabase URL (connect-src 'self' https://*.supabase.co wss://*.supabase.co), images from self and data:, and no inline scripts.
4. Fix public/sw.js so it never caches Supabase requests (same-origin GET only) and bump the cache name. Update manifest theme/background colours to the UX agent's palette once it appears in BOARD.md (default #4f46e5).
5. Update README.md: architecture, env vars, Netlify setup. Do not write app logic or UI.
