# Batches B + C Implementation Report

**Date:** 2026-07-19  
**Scope:** SHISTRI UI/percent, Single Player reset, plant removal, password show/hide

## Completed

| ID | Fix |
|----|-----|
| SHI-UI-001 | MP/Career table uses `canShistri` + `shistriBet` from `@kouppi/game-core` (removed `abs >= 6`) |
| SHI-PCT-001 | `SHISTRI_DEFAULT_PERCENT = 7` / `SHISTRI_DEFAULT_MIN_CHIP = 1` in game-core; wired through SP, MP presets, server rooms, career, how-to-play |
| SP-CFG-001 | `resetSinglePlayer()` on `gameStore`; `/play/single` resets on mount/unmount via `useLayoutEffect` |
| UI-PLANT-001 | `plants: false` on all table themes |
| AUTH-UX-001 | Accessible Show/Hide on login + confirm password |
| AUTH-UX-002 | Partial: username regex + max length on register |

## Tests

- `packages/game-core/tests/shistri.test.ts` — default percent 7
- `apps/web/__tests__/gameStore.reset.test.ts`
- `apps/web/__tests__/batchBC.fixes.test.tsx`
- Full web suite: **79 passed**; game-core: **28 passed**; `pnpm -w build`: **PASS**

## Still open (not this batch)

- AUTH-NET-001 ops (Render/Vercel) — return later
- Batch D: CI-SWALLOW-001, Playwright, etc.
- Batch E: CAREER-DB-001, JWT/Redis/backups
