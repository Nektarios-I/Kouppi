# Player avatars

Transparent bust portraits for seats, lobby, career, friends, and leaderboard.

## Add a new figure

1. Add a square transparent PNG here named `<id>.png` (256×256 recommended).
2. Append `{ id: "<id>" }` to `AVATAR_CATALOG` in `packages/protocol/src/avatars.ts`.
3. Rebuild `@kouppi/protocol` (`pnpm --filter @kouppi/protocol build`).

No other UI wiring is required — picker and seats read the shared catalog.

## Source sheets

Raw Gemini sheets live in `../players-display_raw/`.
Extraction script: `scripts/extract-avatars.py`.
