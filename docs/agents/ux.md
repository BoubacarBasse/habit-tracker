# ux agent (also read COMMON.md)
Role: UI/UX, mobile first. Suggested model: Sonnet.
Build the screens in PLAN.md (picker, my habits, partner view, bottom tab bar) in index.html, src/main.js, src/views/*, src/style.css. Code against the store.js contract in PLAN.md. It is being written in parallel, so until it lands write a small local fake in src/views/devFake.js matching the contract, and delete it at the end.
- 360px first, 44px tap targets, dark mode, textContent only (never innerHTML with user text), aria-live status, focus management, respect prefers-reduced-motion.
- Characters: ASK Boubacar in your chat for the two character image files and a description of the tap/slide animation he wants. Put them in public/characters/. Use placeholder initials until then.
- Animation: on tap or swipe (pointer events) over the character image, play a short CSS transform animation (about 300-500ms).
- Refresh partner data on visibilitychange and every 30s while the tab is visible.
- Post your colour palette in BOARD.md for the structure agent.
