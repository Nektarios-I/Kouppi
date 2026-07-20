# Batches D + E Implementation Report

**Date:** 2026-07-19  
**Scope:** Quality gates (Batch D) + infra hardening (Batch E). No CM-QA-007 product change.

---

## Batch D — Quality gates

| ID | Change | Status |
|----|--------|--------|
| CI-SWALLOW-001 | `.github/workflows/ci.yml`: `pnpm -w test` must pass (removed `\|\| true`) | DONE |
| Friends flake | `sendFriendRequest` reopens declined/cancelled rows (UNIQUE-safe) | DONE |
| EMPTY-CATCH-001 | Structured `console.error` JSON logs instead of empty `catch {}` in `serverFactory` | DONE |
| CAREER-FLOW-TEST-001 | Real matchmaking + rating-delta flow tests replace placeholder | DONE |
| Playwright smoke | `apps/web/playwright.config.ts` + `e2e/smoke.spec.ts`; `test:e2e` runs Playwright | DONE |
| SOFT-REJECT-001 | `IllegalActionError` from reducer; intent ACK `code: "illegal_action"`; SP dispatch no-ops | DONE |

---

## Batch E — Infra hardening

| ID | Change | Status |
|----|--------|--------|
| JWT-SESS-001 | JWT requires `sid`; `verifyActiveAuthToken`; logout deletes session; prod requires `JWT_SECRET`; client logout calls API | DONE (code) |
| REDIS-PKG-001 | `optionalDependencies` for `redis` + `@socket.io/redis-adapter`; docs state queue still in-memory | DONE |
| BACKUP-001 | `scripts/backup-sqlite.sh` + `.ps1`; docs updated | DONE (scripts; schedule is ops) |
| CAREER-DB-001 | Ops docs only — paid disk vs free `/tmp`; no code change | DOCUMENTED |
| CM-QA-007 | Quick-match rating gap | **OPEN** (product decision) |

---

## Validation

- [x] `@kouppi/game-core` — 28 tests
- [x] `@kouppi/server` — 110 tests
- [x] `@kouppi/web` unit — 79 tests (`e2e/` excluded from vitest)
- [x] `pnpm -w build` — PASS
- [ ] Optional: Playwright smoke (`pnpm --filter @kouppi/web test:e2e:install` then `test:e2e`) — browser install may be needed locally/CI

---

## Manual / human remaining

1. AUTH-NET-001 ops: Render `CORS_ORIGIN`, Vercel `NEXT_PUBLIC_SERVER_URL`, `/health/ready`
2. CAREER-DB-001: paid persistent disk if Career data must survive restarts
3. Schedule backup scripts on the DB host
4. CM-QA-007 product decision
