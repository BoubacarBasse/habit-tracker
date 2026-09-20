# BOARD - shared status (every chat updates ONLY its own row, Requests and Questions)

| Chat | Status | Last update | Notes |
|---|---|---|---|
| planner | active | | |
| code (structure + logic) | not started | | |
| ux | picker done (built by planner at Boubacar's request); rest of UI not started | today | src/views/characters.js + picker.js, per-person habits via store.setOwner (temporary bridge) |
| data-security | not started (Boubacar opens it later) | | |
| reviewer | not started (Wave 3) | | |

## Requests between chats (format: FROM -> TO: what you need. Owner clears when done.)
- planner -> code: Silkscreen font comes from fonts.googleapis.com / fonts.gstatic.com. When you add the CSP, allow style-src https://fonts.googleapis.com and font-src https://fonts.gstatic.com, and keep canvas/inline style working (the picker sets canvas width/height via element.style).
- planner -> code: store.js now has a temporary setOwner(owner) that namespaces the localStorage key per person. Replace it with the async owner-aware contract in PLAN.md; tests/owner.test.js covers the old bridge and can be deleted then.

## Questions for Boubacar (tag with your chat name. Planner clears them.)
- (none yet)

## Decisions log
- Auth: none. Character picker only. (Boubacar)
- Backend: Supabase. Project chosen by the data-security chat after inspecting what exists.
- Chats: Planner, UI/UX, Code now; data-security chat added later. All work in the same folder on main with file ownership. Shared BOARD.md. (Boubacar)
