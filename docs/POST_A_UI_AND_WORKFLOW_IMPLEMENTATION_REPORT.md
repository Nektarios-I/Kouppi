# POST-A UI & Workflow — Implementation Report

**Initiative:** Post-Batch-A product/UI phases (no infra/VM work)  
**Last updated:** 2026-07-20

---

## Phase 1 — Remove green plant decorations (UI-PLANT-001)

### Status
**Done**

### Root cause confirmed
`BackgroundProps` renders plant SVGs when `theme.props.plants` is enabled. Shared shells mount that component globally. Themes now keep `plants: false`.

### Exact files changed
| File | Change |
|------|--------|
| `apps/web/lib/tableThemes.ts` | required `plants: boolean`; all `false` |
| `apps/web/components/game/BackgroundProps.tsx` | gate `=== true` |
| `apps/web/__tests__/plants.disabled.test.tsx` | new |

### Validation
`vitest` plants + full web suite (see Phase 5 summary).

---

## Phase 2 — Fresh Single Player on every entry (SP-CFG-001)

### Status
**Done**

### Root cause confirmed
Zustand `gameStore.ready` survived SPA navigation. Fixed via `resetSinglePlayer()` on `/play/single` mount+unmount.

### Exact files changed
| File | Change |
|------|--------|
| `apps/web/store/gameStore.ts` | (existing) `resetSinglePlayer` |
| `apps/web/app/play/single/page.tsx` | (existing) layout effect reset |
| `apps/web/__tests__/gameStore.reset.test.ts` | store contract |
| `apps/web/__tests__/singlePlayer.remount.test.tsx` | **new** remount → dialog |

### What intentionally did not change
MP `remoteGameStore`, Career stores, auth, theme preferences.

---

## Phase 3 — SHISTRI consistency + stake display

### Status
**Done** (rules were already 7%/`canShistri`; stake UI completed)

### Decisions
- Stake copy uses **chips** (not €): `Risk: 7 (7% of pot)` — matches app-wide chip UX (Perplexity + engineering).

### Exact files changed
| File | Change |
|------|--------|
| `apps/web/components/game/GameActionPanel.tsx` | responsive SHISTRI labels + `shistriPercent` |
| `apps/web/components/TableGraphics.tsx` | pass percent |
| `apps/web/components/MultiplayerTableGraphics.tsx` | pass percent |
| `apps/web/__tests__/gameActionPanel.shistri.test.tsx` | **new** |
| CSS in `globals.css` | mobile/compact/desktop label visibility |

### Labels
- Desktop: `SHISTRI` + `Risk: N (P% of pot)`
- Laptop: `SHISTRI · N`
- Mobile: `SHISTRI N` + helper `P% of pot`

---

## Phase 4 — Responsive game stage / always-visible actions

### Status
**Done** (code); **manual viewport matrix still required**

### Root cause confirmed
Width-driven `aspect-[16/10]` table + document-flow dock under `min-h-screen` overflowed laptop heights.

### Exact files changed
| File | Change |
|------|--------|
| `apps/web/components/game/CasinoBackground.tsx` | `100dvh` shell |
| `apps/web/components/PokerTable.tsx` | `poker-table-root` / surface classes |
| `apps/web/components/TableGraphics.tsx` | `game-stage` layout |
| `apps/web/components/MultiplayerTableGraphics.tsx` | same |
| `apps/web/app/globals.css` | viewport budget CSS |
| `docs/GAME_VIEWPORT_MANUAL_TEST.md` | **new** matrix |

### Height model
`--game-chrome-h` reserves HUD+dock; table `max-height: calc(100dvh - var(--game-chrome-h))`; secondary log collapses on short heights.

---

## Phase 5 — Career league entry / matchmaking feedback

### Status
**Done** for queue UX + waiting-table sockets wrapping existing manager APIs

### Root cause confirmed (queue “does nothing”)
Server used `cb ? cb() : emit(queueJoined)` while client always passed a callback and ignored ACK → searching UI never appeared / stuck `…`.

### Exact files changed
| File | Change |
|------|--------|
| `apps/server/src/career/careerSocketHandlers.ts` | ACK **and** emit; `list/create/joinWaitingRoom` |
| `apps/web/store/careerLobbyStore.ts` | ACK apply, optimistic search, waiting APIs |
| `apps/web/components/CareerLobby.tsx` | Searching/league copy, Quick Match, Create/Join waiting |
| `apps/web/store/careerLobbyStore.test.ts` | ACK + duplicate join |
| `apps/server/tests/career/waitingTables.test.ts` | **new** |

### Waiting tables
- List/create/join use existing `createCareerRoom` / `joinCareerRoom` / `getRoomsByAnte`.
- Join rejects `status !== "waiting"` (`game_in_progress`).
- No late join to ranked games in progress.

### Explicit non-goals kept
No VM/DB migration, Redis, rating-gap policy change (CM-QA-007 still open).

---

## Validation summary (2026-07-20)

```text
apps/web:     pnpm exec vitest run  → 20 files, 90 tests PASS
apps/server:  waitingTables + auth.http focused PASS
apps/server:  (full suite run in same session — see command log)
apps/web:     production build run in same session
```

---

## Manual review & extra attention (operator)

See end-of-chat report section in the assistant message.

### Recommended next
Human: run viewport matrix + live Career queue with two accounts on local/staging server. Infra/VM remains yours.
