# KOUPPI Player Workflow Test Plan

**Date:** 2026-07-19  
**Companion docs:** `COMPREHENSIVE_BUG_AND_WORKFLOW_AUDIT.md`, `BUG_FIX_BACKLOG.md`

---

## Existing test setup

| Layer | Tooling | Location |
|-------|---------|----------|
| Unit / integration | Vitest | `packages/*`, `apps/server`, `apps/web` |
| Component | RTL + jest-dom + jsdom | `apps/web/__tests__`, `vitest.setup.ts` |
| Property-ish | fast-check | `packages/game-core/tests/invariants*.ts` |
| E2E | `@playwright/test` in web package.json | **No playwright.config; `test:e2e` echo-skips** |
| CI | `.github/workflows/ci.yml` | `pnpm -w test \|\| true` then build |
| Test DB | Temp `DATABASE_PATH` under `os.tmpdir()` | friends / career / trophyFloor tests |
| Server helpers | `createKouppiServer`, `resetAllRoomsForTests` | `apps/server/tests/*` |

### Package scripts

```bash
# From repo root (use Node 20; project ships .tools/node-v20.19.0-win-x64 on Windows)
pnpm test                          # turbo test all packages
pnpm --filter @kouppi/game-core test
pnpm --filter @kouppi/server test
pnpm --filter @kouppi/web test
pnpm --filter @kouppi/database test
pnpm --filter @kouppi/web test:e2e # currently skips unless Playwright configured
```

Windows note: if `pnpm` is missing from PATH, prepend `.tools/node-v20.19.0-win-x64` and `corepack prepare pnpm@10.12.4 --activate`.

---

## Proposed test pyramid

```
        /\
       /E2E\     Playwright: 5 critical journeys (after config)
      /------\
     / Integr \  Server sockets + auth HTTP + career queue wiring
    /----------\
   / Unit rules \  game-core SHISTRI/bet/kouppi + store reset + URL resolve
  /--------------\
```

**Principles:** deterministic decks/fixtures; isolated temp DB; no production credentials; wait on UI/network conditions, not fixed sleeps; never point tests at prod SQLite.

---

## Unit tests

### Added this audit (passing)

**File:** `packages/game-core/tests/shistri.test.ts` (25 tests)

| Case | Coverage |
|------|----------|
| Eligibility valid | A+3, 2+4, 5+7, 10+Q, J+K, reversed order |
| Eligibility invalid | A+2, 2+3, Q+K, Q+A, K+A, K+2, same rank, abs=6 |
| Suit irrelevant | same ranks different suits |
| Stake | 7% / 5% floor; minChip; small pot |
| Win | whole pot credited; pot→0 |
| Loss | stake only deducted |
| Illegal reject | pot/bankroll unchanged |
| KOUPPI vs SHISTRI loss | risk differs |
| Default percent doc | shipped default still 5 (until product fix) |

### Planned unit tests

| ID | Target | Cases | Blocker |
|----|--------|-------|---------|
| UT-SP-001 | `gameStore` reset | After configure `ready===true`; after `resetSinglePlayer` `ready===false` and bootstrap state; MP stores untouched | Needs `resetSinglePlayer` API |
| UT-SHI-UI-001 | Extract eligibility helper or import `canShistri` in MP | assert MP path uses core | Needs UI fix |
| UT-BET-001 | Normal bet win/loss slice | conserve chips | Optional strengthen |
| UT-KOUPPI-001 | Whole-pot risk | win/loss | Partial via shistri.test contrast |
| UT-URL-001 | `serverUrl` | already in `serverUrl.test.ts` | Extend auth diagnostic helper when added |

### SHISTRI eligibility matrix (source of truth)

Eligible iff `abs(rank1-rank2)===2` with Ace=1…King=13:

| Pair | Expected |
|------|----------|
| A–3, 2–4, 5–7, 10–Q, J–K | eligible |
| A–2, 2–3, Q–K, Q–A, K–A, K–2, pair | not eligible |

---

## Integration tests

### Planned

| ID | Scope | Assertions | Setup |
|----|-------|------------|-------|
| IT-AUTH-001 | `POST /api/auth/register` | 201; user row; password not plaintext | Temp DB + `createKouppiServer` |
| IT-AUTH-002 | Duplicate username | 409 clear message | Same |
| IT-AUTH-003 | Bad password / validation | 400 | Same |
| IT-AUTH-004 | Login valid/invalid | JWT returned / 401 | Same |
| IT-CAREER-001 | Progression after match | rating delta correct; trophies; leaderboard | Requires rating fix + match end hook |
| IT-MM-001 | Queue → matchFound | Two sockets receive room; **fails if callback unwired** | Wire production + assert factory installs callback |
| IT-MP-SHI-001 | Socket shistri | Eligible accepted; ineligible rejected (no pot change) | Fixed deck fixture / state inject if available |
| IT-HEALTH-001 | `/health/ready` | `ok` + `database` flag | Existing patterns |

### Existing related tests

- `apps/server/tests/career/queue.test.ts` — sets `setOnMatchFound` locally (does **not** prove production wiring).
- `careerQueueIntegration.test.ts` — socket queue; depends on wiring in test server factory path.
- `careerGameFlow.test.ts` — **real** matchmaking + rating-delta game-end tests (placeholder claim is obsolete).
- `careerFlowContracts.test.ts` — **Batch 1** Tier-1 contracts: QJ-001..003, CT-001, JT-001, CD-001/002, ERR-001 (Node 20 + temp SQLite).
- `apps/web/store/careerLobbyStore.test.ts` — queue/create/wait store contracts (incl. WEB-QJ/CT/WAIT).
- `friends.test.ts` — known UNIQUE flake risk; isolate DB path carefully.

### Career matchmaking / table flow (from CAREER_MATCHMAKING audit)

| ID | Status | Notes |
|----|--------|-------|
| CAREER-IT-QJ-001..003 | Implemented | `careerFlowContracts.test.ts` |
| CAREER-IT-CT-001 | Implemented | create + **idempotent** duplicate (Batch 3) |
| CAREER-IT-JT-001 | Implemented | join + reject matrix |
| CAREER-IT-CD-001/002 | Implemented (Batch 2) | Ready gate + 60s; short injectable delay for socket IT; fake-timer cancel unit |
| CAREER-IT-NAV-001 | Implemented (Batch 3) | `transitionToGame` → `subscribeCareerRoom` dual-socket |
| CAREER-IT-ERR-001 | Implemented | safe ACK errors |
| CAREER-WEB-QJ/CT/WAIT | Partial (store) | `careerLobbyStore.test.ts` incl. setReady |
| Playwright two-browser Career | **Implemented locally** | Create route + two-user Quick Match + shared table/config/refresh assertions; not in CI |

---

## E2E tests

### Setup required (smallest clean path)

1. Add `apps/web/playwright.config.ts` with `webServer` starting web+server or document two-process local start.
2. Use test project env: `NEXT_PUBLIC_SERVER_URL=http://localhost:4000`, temp `DATABASE_PATH`.
3. Replace echo-skip `test:e2e` with real `playwright test`.
4. Optional CI job (after `\|\| true` removed) with browsers install.

### Scenarios

#### E2E 1 — Single Player re-entry
1. Open `/` → Single Player  
2. Complete SettingsDialog → Start  
3. Exit to home  
4. Single Player again  
5. **Assert:** SettingsDialog visible (`ready` false)

#### E2E 2 — SHISTRI UI/gameplay
1. Deterministic fixture: upcards A+3 (or seed that yields gap=1)  
2. Assert SHISTRI enabled; play; assert pot/bankroll  
3. Fixture Q+A: SHISTRI disabled  
4. MP: attempt illegal intent → server no-op/reject  

#### E2E 3 — Career registration/login
1. `/career` → create unique user  
2. Assert logged-in UI  
3. Password toggle: type → show → hide → value preserved  
4. Duplicate / short password → clear errors  
5. **No prod credentials**

#### E2E 4 — Career game + leaderboard
1. Sign in test user  
2. Matchmaking (after CAREER-MM-001 fix) or test hook  
3. Controlled result  
4. Leaderboard shows user  

#### E2E 5 — Multiplayer two-client
1. Context A creates room  
2. Context B joins  
3. Sync assertion on ready/state  
4. Action in A visible in B  

---

## Required fixtures / mocks / test database strategy

| Need | Approach |
|------|----------|
| Cards / SHISTRI | Force `turn.upcards` + deck head in unit tests (see `shistri.test.ts`); for server, prefer seed + inject or test-only helper guarded by `NODE_ENV=test` |
| Auth | Unique usernames `e2e_${Date.now()}`; bcrypt real; never log passwords |
| DB | `DATABASE_PATH=os.tmpdir()/kouppi-test-<uuid>.db`; delete after suite |
| Matchmaking | Always `setOnMatchFound` in test server boot; add assertion production boot does too |
| RNG | Fixed `seed` in `initGame` |
| Network | Mock `fetch` only for pure UI tests; integration uses real local server |

---

## Exact commands to run tests

```bash
# All
pnpm -w test

# SHISTRI regression only
pnpm --filter @kouppi/game-core test -- tests/shistri.test.ts

# Server (includes career/MP)
pnpm --filter @kouppi/server test

# Web unit
pnpm --filter @kouppi/web test

# After Playwright config exists
pnpm --filter @kouppi/web exec playwright test
```

Local full stack for manual/E2E:

```bash
pnpm --filter @kouppi/server dev   # :4000
pnpm --filter @kouppi/web dev      # :3000
```

---

## Manual production verification checklist

- [ ] Vercel `NEXT_PUBLIC_SERVER_URL` = Render HTTPS origin (redeployed after change)
- [ ] Render `CORS_ORIGIN` includes exact Vercel origin(s)
- [ ] `GET https://<server>/health/ready` → `ok: true`, `database: true`
- [ ] Career register succeeds; Network shows POST to Render host, not Vercel/localhost
- [ ] Free tier: wake service if sleeping; accept ephemeral DB warning
- [ ] Plants gone after UI-PLANT-001
- [ ] SP exit → re-enter shows settings
- [ ] MP/Career: A+3 shows SHISTRI; Q+A hides; stake % matches product (7)
- [ ] Two users can matchmake and finish a career game; ratings move by sensible deltas
- [ ] Leaderboard updates
- [ ] Password show/hide on login/register
- [ ] Widths 320 / 375 / 390 / 414 / 768 / 1024 / 1366 smoke

---

## What cannot currently be automated and why

| Item | Why |
|------|-----|
| Live Vercel↔Render CORS/env | Needs deployed secrets/dashboard; local cannot prove prod env |
| Free Render cold start flakiness | Timing/infra nondeterministic |
| Full Career E2E before matchmaking wire | Feature dead in production entry |
| Playwright journeys | No config/specs yet |
| Visual plant regression without screenshot tooling | Optional Percy/Chromatic not present |
| Production DB data integrity | Must not touch prod DB from CI |

---

## Mapping to user workflows

| Workflow step | Automate level |
|---------------|----------------|
| Open site / choose SP | E2E1 |
| Configure / start / bet / kouppi / shistri | Unit + E2E2 |
| Exit / re-enter SP | E2E1 + UT-SP-001 |
| MP create/join | E2E5 + existing server tests |
| Career signup/signin | IT-AUTH + E2E3 |
| Matchmaking / progression / leaderboard | IT-MM / IT-CAREER / E2E4 after P0 fixes |
| Reconnect | Existing sprint reconnect tests; extend as needed |
