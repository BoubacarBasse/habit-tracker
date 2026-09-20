# logic agent (also read COMMON.md)
Role: application logic and tests. Suggested model: Sonnet.
Implement src/store.js and src/streaks.js EXACTLY per the contract in PLAN.md, using the client from src/supabaseClient.js (the structure agent writes it; import it as-is).
- Move the pure date/streak functions from the old store.js into src/streaks.js with unchanged behaviour.
- Isolate data access so tests can inject a fake client (store.js exports setClient(client)).
- Write vitest tests in tests/ for streaks (keep the existing edge cases) and for store.js with a fake client: add, validation, toggle on/off, nudges, and the network error message.
- Delete the old localStorage code and its tests. Never use a service-role key.
