# Career Matchmaking Implementation Report

**Last updated:** 2026-07-22  
**Related audit:** `docs/CAREER_MATCHMAKING_AND_TABLE_FLOW_AUDIT.md`

---

## Batch 3 — Navigation cohesion, cleanup, idempotent create, E2E plan

### Status
Done

### Defects addressed
- **CAREER-CD-003** — Stale-room `setInterval` no longer module-global forever; `startCareerStaleRoomCleanup` / `stopCareerStaleRoomCleanup` wired through `createKouppiServer` / `stopCleanup`
- **CAREER-CT-002** — Duplicate Create Waiting Table returns the same room with `idempotent: true` (rebinds socket)
- **CAREER-CT-001 / CAREER-NAV-001** — Accepted **in-lobby** waiting on `/career`; dual-socket game entry proven by `CAREER-IT-NAV-001` (`transitionToGame` → `subscribeCareerRoom` on new sockets)
- E2E plan documented (not coded/CI): `docs/CAREER_E2E_TWO_BROWSER_PLAN.md`

### Files changed
- `apps/server/src/career/careerRoomManager.ts`
- `apps/server/src/career/careerSocketHandlers.ts`
- `apps/server/src/serverFactory.ts`
- `apps/server/tests/career/careerFlowContracts.test.ts`
- `apps/server/tests/career/matchmakingWiring.test.ts`
- `docs/CAREER_E2E_TWO_BROWSER_PLAN.md` (new)
- `docs/CAREER_MATCHMAKING_AND_TABLE_FLOW_AUDIT.md`
- `docs/CAREER_MATCHMAKING_IMPLEMENTATION_REPORT.md`
- `docs/PLAYER_WORKFLOW_TEST_PLAN.md`

### Tests added or updated
| ID | Change |
|----|--------|
| CAREER-IT-CT-001 | Duplicate create asserts idempotent same `roomId` |
| CAREER-IT-NAV-001 | New — game subscribe after transition on second sockets |
| matchmakingWiring | Asserts stale-room cleanup starts/stops with factory |

### Validation
Node **20.19.0**:

| Command | Result |
|---------|--------|
| `vitest run tests/career/careerFlowContracts.test.ts tests/career/matchmakingWiring.test.ts` | **PASS** 15 |

### Manual verification steps
1. Create Waiting Table twice quickly → stay in same waiting room (no error).
2. Complete Ready → start → confirm `/room/career-game-*` loads via subscribe path.
3. Stop server cleanly; no leaked Career stale-room interval in tests.

### Remaining Career issues
- CAREER-QJ-002 (product: unlimited rating gap after 45s)
- CAREER-TEST-002 (Node 25 vs better-sqlite3 — use Node 20)
- Browser E2E not implemented yet (plan only)

### Next action
Career matchmaking/table flow batches 1–3 are complete. Optional follow-up: implement `docs/CAREER_E2E_TWO_BROWSER_PLAN.md` locally when ready.

---

## Batch 2 — Ready gate + 60s countdown + join lock + max 2

### Status
Done

### Defects addressed
- CAREER-QJ-001, CAREER-CD-001, CAREER-CD-002, CAREER-JT-001 (+ Ready protocol/UI)

### Validation
- careerFlowContracts + related + lobby store PASS (Node 20)

---

## Batch 1 — Characterization tests + auto-start `not_all_ready` fix

### Status
Done

### Defects addressed
- CAREER-TEST-001, CAREER-CD-004, CAREER-TEST-003 (docs)
