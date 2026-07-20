# KOUPPI Database & Infrastructure Audit

**Audit date:** 2026-07-19  
**Scope:** Repository `kouppi/` (monorepo root). Conclusions are derived from code, configs, docs, and scripts in this repo only.  
**No load benchmarks exist in the repository.** Capacity numbers below are conservative architecture-based estimates, not measured results.

---

## 1. Executive overview

KOUPPI is a pnpm + Turborepo monorepo with three runtime pieces:

| Piece | Package | Typical host |
|-------|---------|--------------|
| Next.js frontend | `apps/web` | Vercel |
| Authoritative game + API server | `apps/server` | Render (or Railway/Fly/VPS) — **not** Vercel |
| SQLite persistence library | `packages/database` | Runs **inside** the game server process |

The database engine is **SQLite**, accessed via **`better-sqlite3`**. The file path is controlled by `DATABASE_PATH` (default: `{process.cwd()}/data/kouppi.db`). Schema is created/migrated automatically on first `getDatabase()` call — there is no separate migration runner or seed CLI.

**What SQLite stores:** accounts (bcrypt passwords), career progression (bankroll, rating, trophies, arenas), 1v1-shaped match history rows, login session rows (mostly unused for auth), friends graph, and completed casual “friends” session summaries for logged-in users.

**What SQLite does *not* store:** live multiplayer rooms, Socket.IO connections, turn timers, reconnect grace, career matchmaking queue, career waiting rooms, or friend online presence. Those live in process memory (and optionally Redis if `REDIS_URL` is set and optional Redis packages are installed).

**Deployment split:** Browser → Vercel (`apps/web`) → HTTPS/WSS to game server → SQLite file on that host’s disk. Free Render uses `/tmp/kouppi.db` (ephemeral). Paid `render.yaml` mounts `/var/data/kouppi.sqlite`.

**Biggest operational truths today:**

1. One Node process owns almost all multiplayer state unless Redis is configured.
2. Career/auth data durability depends entirely on whether the SQLite path is on a persistent disk.
3. Auth is JWT-primary; the `sessions` table is written but not used for request authorization.
4. As of this audit, career matchmaking’s `setOnMatchFound` / `runMatchmaking` loop is **not wired** in `serverFactory.ts` / `server.ts` (only in unit tests) — see Risks.

---

## 2. Current architecture

### 2.1 Text diagram

```
┌─────────────────────┐         NEXT_PUBLIC_SERVER_URL
│  Browser            │  REST + Socket.IO (wss)
│  apps/web (Next.js) │────────────────────────────────┐
│  Hosted on Vercel   │                                │
└─────────────────────┘                                ▼
                                              ┌────────────────────────────┐
                                              │  apps/server (Node)        │
                                              │  Express + Socket.IO       │
                                              │  Host: Render / VPS        │
                                              │                            │
                                              │  In-memory:                │
                                              │   rooms, timers, queue,    │
                                              │   career rooms, presence*  │
                                              │                            │
                                              │  Optional Redis*           │
                                              │   adapter + room snapshot  │
                                              │   + presence               │
                                              │                            │
                                              │  @kouppi/database          │
                                              │   better-sqlite3 ──────────┼──► SQLite file
                                              └────────────────────────────┘
                                                       │
                                                       │ DATABASE_PATH
                                                       ▼
                                              Local:  <cwd>/data/kouppi.db
                                              Free:   /tmp/kouppi.db
                                              Paid:   /var/data/kouppi.sqlite
```

\* Without `REDIS_URL`, presence and rooms are in-memory only. Redis client packages are **not** declared in `apps/server/package.json`; they are optional dynamic imports.

### 2.2 What runs where

| Feature | Frontend (Vercel) | Game server | SQLite |
|---------|-------------------|-------------|--------|
| Single-player `/play/single` | Client `gameStore` + `@kouppi/game-core` | Not required | No |
| Casual multiplayer lobby/rooms | Socket.IO client | Authoritative rooms + game state | Only friends session stats on room close (logged-in) |
| Auth register/login | `authStore` → REST | `/api/auth/*` | `users`, `sessions` (write) |
| Career profile/leaderboard | REST | `/api/profile`, `/api/leaderboard`, `/api/matches` | `users`, `matches` |
| Career matchmaking | Socket `career:*` | In-memory queue + career rooms | Reads users; writes on game end |
| Friends list/requests | REST + sockets | `/api/friends/*`, presence | `friendships`, `friend_requests` |
| Casual friends stats page | REST | `/api/casual/stats` | `casual_sessions*` |

### 2.3 Feature → runtime dependency

- **Solo play:** frontend only.
- **Guest casual multiplayer:** game server required; no durable DB writes.
- **Logged-in casual / friends history:** game server + SQLite.
- **Career / friends social graph / auth:** game server + SQLite (and JWT).
- **Horizontal multi-instance multiplayer:** not safe without Redis + shared room/queue strategy (queue still in-memory even with Redis today).

---

## 3. Database overview

### 3.1 Engine and driver

| Item | Value |
|------|--------|
| Engine | SQLite 3 (via native addon) |
| Library | `better-sqlite3` `^11.7.0` (`packages/database/package.json`) |
| Password hashing | `bcrypt` `^5.1.1` (same package) |
| Access pattern | Synchronous prepared statements; singleton connection in process |
| Journal mode | `PRAGMA journal_mode = WAL` set on open (`client.ts`) |
| Foreign keys | **Not** enabled via `PRAGMA foreign_keys = ON` in code (SQLite default is OFF for the connection unless set) |

### 3.2 File / service location

| Environment | Path | Source |
|-------------|------|--------|
| Local default | `{process.cwd()}/data/kouppi.db` | `packages/database/src/client.ts` `getDefaultDbPath()` |
| Typical local (server `pnpm dev` from `apps/server`) | `apps/server/data/kouppi.db` | cwd = `apps/server` |
| Override | Any path via `DATABASE_PATH` | env |
| Render Free (`render.free.yaml`) | `/tmp/kouppi.db` | ephemeral |
| Render Paid (`render.yaml`) | `/var/data/kouppi.sqlite` | 1 GB disk mounted at `/var/data` |

**Important:** Path is cwd-relative when unset. Running the server from different directories creates **different** DB files. This audit found multiple `kouppi.db` copies under workspace/`node_modules` paths from prior runs — treat `apps/server/data/kouppi.db` as the usual local file when starting via `@kouppi/server` scripts.

SQLite is **local file-based embedded** storage inside the game-server process — not a remote managed DB service.

### 3.3 Schema ownership and initialization flow

On `createKouppiServer()` (unless `skipCareerDatabase`):

1. `getDatabase()` (`packages/database/src/client.ts`)
2. Ensure parent directory exists (`fs.mkdirSync`)
3. `new Database(finalPath)`
4. `db.pragma("journal_mode = WAL")`
5. `db.exec(SCHEMA_SQL)` — users, matches, sessions + indexes
6. `runMigrations(db)` — adds `casual_games_played` / `casual_mvp_count` columns if missing; execs `CASUAL_SCHEMA_SQL` + `FRIENDS_SCHEMA_SQL`
7. Hourly `cleanupExpiredSessions()` interval in `serverFactory.ts`

There is **no** versioned migration table, **no** seed script, **no** admin DB API, and **no** backup script in the repo.

If DB init fails, the server **continues** with `careerDatabaseReady = false` (casual sockets may still work; career/auth that need DB will fail).

### 3.4 Persistence model

| Data class | Persistence |
|------------|-------------|
| User accounts & career stats | Durable SQLite (if disk durable) |
| Match history rows | Durable SQLite |
| Friends graph | Durable SQLite |
| Casual friends session history | Durable SQLite (on room close) |
| JWT validity | Stateless crypto (secret in env); survives restart |
| DB `sessions` rows | Written on login/register; **not** checked by `requireAuth` |
| Live rooms / game state | Memory (± Redis snapshots if configured) — lost on restart without Redis hydrate |
| Matchmaking queue | Memory only — lost on restart |
| Career waiting rooms / timers | Memory only — lost on restart |
| Friend presence | Memory or Redis TTL — not SQLite |
| Browser auth token | `localStorage` key `kouppi-auth` (zustand persist) |
| Guest player id/name/avatar | `sessionStorage` |
| Join/reconnect room hints | `sessionStorage` |

---

## 4. Data model inventory

### 4.1 `users`

| | |
|--|--|
| **Purpose** | Accounts + career progression + casual rollup counters |
| **PK** | `id` (TEXT UUID) |
| **Columns** | `username` (UNIQUE NOCASE), `password_hash`, `created_at`, `last_login_at`, `bankroll`, `rating`, `trophies`, `highest_trophies`, `arena`, `games_played`, `games_won`, `total_earnings`, avatar fields, plus migration cols `casual_games_played`, `casual_mvp_count` |
| **Indexes** | `idx_users_username`, `idx_users_trophies`, `idx_users_rating` |
| **Relationships** | Referenced by `matches`, `sessions`, `casual_session_players`, `friendships`, `friend_requests` |
| **Read/write** | `packages/database/src/users.ts`; auth routes; career end; casual persist; friends; leaderboard |

**Used by:** Auth, Career, Friends, Casual stats, Leaderboard.

### 4.2 `matches`

| | |
|--|--|
| **Purpose** | Career match history (schema is **1v1**: player1/player2) |
| **PK** | `id` |
| **Columns** | player ids, winner, rating/trophy change fields, rounds, duration, final bankrolls |
| **Indexes** | by player1, player2, created_at |
| **Relationships** | FK to `users` (declared in DDL) |
| **Read/write** | `matches.ts`; written in `careerRoomManager.handleCareerGameEnd` (winner + runner-up only for multiplayer); read via `/api/matches` |

**Caveat:** Multiplayer career games still insert a single 1v1-shaped row for top two finishers; rating/trophy change columns are often completed as `0` because updates are applied directly to `users` first.

### 4.3 `sessions`

| | |
|--|--|
| **Purpose** | Intended login session tracking (7-day expiry helpers) |
| **PK** | `token` (UUID, **not** the JWT) |
| **Columns** | `user_id`, `created_at`, `expires_at` |
| **Indexes** | user, expires |
| **Read/write** | `sessions.ts`; `createSession` on register/login; hourly cleanup |

**Auth reality:** HTTP middleware and career sockets validate **JWT** via `jsonwebtoken` + `JWT_SECRET`. Logout does **not** delete the DB session row. `validateSession` is unused by auth middleware. JWT cannot be revoked by deleting `sessions` rows.

### 4.4 `casual_sessions` / `casual_session_players`

| | |
|--|--|
| **Purpose** | History of completed friends multiplayer sessions for logged-in users |
| **PK** | `casual_sessions.id`; players keyed by `(session_id, …)` without composite PK |
| **Write path** | Room close → `persistCasualFriendsSessionFromRoom` → `recordCasualFriendsSession` |
| **Skip rule** | Guest ids `player_*` are not persisted; session not stored if no logged-in participants |
| **Read** | `GET /api/casual/stats` |

### 4.5 `friendships` / `friend_requests`

| | |
|--|--|
| **Purpose** | Social graph |
| **PK** | friendships `(user_id, friend_id)`; requests `id` + UNIQUE `(from_user_id, to_user_id)` |
| **Read/write** | `packages/database/src/friends.ts` + `friendsRoutes` / friend sockets |

Presence status is **not** in these tables.

### 4.6 Arenas (not a table)

Arena definitions live in code (`ARENAS` in `schema.ts`), not in SQLite.

---

## 5. Runtime state inventory

### 5.1 In-memory only (lost on process restart)

| State | Location | Notes |
|-------|----------|-------|
| Casual/career game rooms | `InMemoryRoomStore` Maps in `roomStore.ts` via `rooms.ts` | Authoritative game state, players, chat, session stats |
| Room codes index | same store | Code → room id |
| Turn / decision / reconnect timers | attached to room objects + intervals in `serverFactory` / `rooms` | `RECONNECT_GRACE_MS = 45_000` |
| Career waiting rooms | `careerRooms` Map in `careerRoomManager.ts` | Auto-start 30s timers |
| Career queue | `queue` Map in `queue.ts` | Not Redis-backed |
| Career socket auth map | `authenticatedSockets` in `careerSocketHandlers.ts` | |
| Friend presence | `InMemoryPresenceStore` unless Redis | |
| Rate-limit counters | `security/rateLimit.ts` | Per socket |
| Socket.IO connections | engine | |

### 5.2 Restart consequences

| On server restart | Effect |
|-------------------|--------|
| Active tables / hands | Gone (unless Redis room hydrate recovers snapshots — timers still local) |
| Lobby list | Empty until new rooms created |
| Players mid-game | Disconnect; client may hold sessionStorage hints but room is gone |
| Matchmaking queue | Cleared |
| Career waiting rooms | Cleared |
| SQLite career accounts | Survive **if** `DATABASE_PATH` is on persistent disk |
| Free Render `/tmp` DB | **Wiped** on restart/redeploy |
| JWT in browser | Still valid until expiry if secret unchanged |

### 5.3 Client-side persistence (not server DB)

- `localStorage` `kouppi-auth` — JWT + cached profile  
- `sessionStorage` — guest id/name/avatar, active room code, join session token  
- UI prefs (theme, muted players, conduct gate, PWA dismiss)

---

## 6. Infrastructure / deployment overview

### 6.1 Local development

Typical:

```text
pnpm --filter @kouppi/web dev     → http://localhost:3000
pnpm --filter @kouppi/server dev  → http://localhost:4000 (Socket.IO + REST)
```

Frontend resolves server URL via `apps/web/lib/serverUrl.ts`: `NEXT_PUBLIC_SERVER_URL`, else `:3000`→`:4000` port swap, else `http://localhost:4000`.

Node: `.nvmrc` = **20** (native modules for `better-sqlite3` / `bcrypt`).

### 6.2 Production frontend (Vercel)

- Root directory: `apps/web`
- `apps/web/vercel.json`: install/build from monorepo root via turbo filter `@kouppi/web`
- Required: `NEXT_PUBLIC_SERVER_URL` = game server HTTPS origin (build-time inline)
- Optional: `NEXT_PUBLIC_SITE_URL`

**Vercel does not run the game server or host SQLite for multiplayer.**

### 6.3 Production game server (Render)

| Blueprint | Plan | DB path | Disk |
|-----------|------|---------|------|
| `render.yaml` | starter (paid) | `/var/data/kouppi.sqlite` | 1 GB at `/var/data` |
| `render.free.yaml` | free | `/tmp/kouppi.db` | none — ephemeral |

Build: `pnpm install --frozen-lockfile && pnpm exec turbo build --filter=@kouppi/server`  
Start: `node apps/server/dist/server.js`  
Health: `GET /health`, `GET /health/ready` (`database`, `redis`, `connections`, `rooms`)

Env (server): `PORT` (injected on Render), `CORS_ORIGIN`, `JWT_SECRET`, `DATABASE_PATH`, optional `REDIS_URL`, `NODE_ENV`.

### 6.4 Key URLs / endpoints

| Kind | Path / event |
|------|----------------|
| Health | `GET /health`, `GET /health/ready` |
| Auth | `POST /api/auth/register|login|logout|refresh`, `GET /api/auth/me` |
| Profile / LB / matches | `/api/profile*`, `/api/leaderboard`, `/api/matches*` |
| Casual stats | `GET /api/casual/stats` |
| Friends REST | `/api/friends/*` |
| Socket.IO | `wss://<server>/socket.io/` — room create/join/intent/chat; `career:*`; `friends:*` |

### 6.5 Persistent disk assumptions

- **Paid Render disk:** Career data survives redeploys if mount + path stay correct.
- **Free `/tmp`:** Demo only — accounts/ratings wiped on sleep/restart/redeploy (documented in `RENDER_FREE_DEPLOYMENT_PREP.md`).
- **No automated backups** in repo or blueprints.

---

## 7. Database access and modification

See companion guide: [`DATABASE_ACCESS_GUIDE.md`](./DATABASE_ACCESS_GUIDE.md).

Summary:

- Prefer **DB Browser for SQLite** or `sqlite3` CLI against a **stopped** server or a file copy.
- Local primary path: `kouppi/apps/server/data/kouppi.db` (when cwd was `apps/server`).
- Production: copy from Render disk / shell; never point a public URL at the `.sqlite` file.
- Schema/migrations: `packages/database/src/schema.ts`, `migrations.ts`, `client.ts`.
- App access layer: `users.ts`, `sessions.ts`, `matches.ts`, `casualSessions.ts`, `friends.ts`.

---

## 8. Scaling assessment

See companion: [`SCALING_ASSESSMENT.md`](./SCALING_ASSESSMENT.md).

Short version:

| Dimension | Current limit driver |
|-----------|----------------------|
| DB file size | Not the near-term bottleneck (small row counts expected) |
| DB concurrency | SQLite single-writer; writes are infrequent (auth, match end, friends) |
| Multiplayer throughput | Single Node process + in-memory rooms + Socket.IO |
| Horizontal scale | Unsupported without Redis; queue still single-process even then |
| Free Render | Sleep/cold start + ephemeral DB |

---

## 9. Risks and problems (prioritized)

| Sev | Risk | Evidence |
|-----|------|----------|
| **P0** | Career matchmaking callback/loop not wired in production server entry | `setOnMatchFound` / `runMatchmaking` / `handleMatchFound` only linked from tests; `joinQueue` discards `tryFindMatch` result and relies on unset callback |
| **P0** | Free-tier ephemeral SQLite destroys Career/auth data | `render.free.yaml` → `/tmp/kouppi.db` |
| **P0** | Rating update likely wrong: absolute rating passed as delta | `handleCareerGameEnd` calls `updateRatingAndTrophies(userId, newRating, trophyChange)` but API expects `ratingChange` |
| **P1** | No backups / restore runbook in automation | No scripts; disk-only |
| **P1** | Multi-instance unsafe without Redis; Redis deps not in package.json | `redisClient.ts` dynamic import; queue still Map |
| **P1** | JWT default secret if `JWT_SECRET` unset | `auth/jwt.ts` |
| **P1** | `sessions` table unused for auth; logout does not revoke JWT | `middleware.ts`, `auth/routes.ts` |
| **P2** | `PRAGMA foreign_keys` not enabled | `client.ts` |
| **P2** | Match history schema 1v1 vs multiplayer career | `schema.ts` + `handleCareerGameEnd` |
| **P2** | cwd-relative default DB path → multiple DB files | Observed under `apps/server/data` and `node_modules/**/data` |
| **P2** | CareerPlayer typo fields (`odlayerId`, etc.) | `careerRoomManager.ts` — fragility |
| **P2** | Observability: structured start log only; no metrics/APM | |
| **P3** | QA doc claims matchmaking loop fixed in `serverFactory` — **stale vs current code** | `CAREER_MODE_QA_VALIDATION_REPORT.md` vs grep |

### Security notes

- Passwords: bcrypt (good).
- JWT in localStorage (XSS risk class — standard SPA tradeoff).
- CORS empty array if `CORS_ORIGIN` missing in production (warns; blocks browsers).
- Room passwords hashed (`security/password.ts`).
- Join session tokens for reconnect (`joinToken.ts`).
- DB file must not be web-exposed; keep on private disk.
- No admin API found for arbitrary SQL.

---

## 10. Recommendations

### Immediate (before any public Career release)

1. Wire `setOnMatchFound((m) => handleMatchFound(m, io))` and a periodic `runMatchmaking()` in `createKouppiServer`, or call `handleMatchFound` from `joinQueue`/`tryFindMatch` return path — then add a regression test that fails if unwired.
2. Fix rating persistence: pass `newRating - careerPlayer.rating` (or change API to accept absolute rating).
3. Use **paid persistent disk** (or managed Postgres) for any real accounts — do not use Free `/tmp` for Career.
4. Set strong `JWT_SECRET` and correct `CORS_ORIGIN` / `NEXT_PUBLIC_SERVER_URL`.
5. Document and script a backup of the SQLite file (cron or host snapshot).

### Near-term

1. Enable `PRAGMA foreign_keys = ON`.
2. Either use `sessions` for revocation or stop writing unused rows; implement logout blacklist/rotation if needed.
3. Pin `DATABASE_PATH` to an absolute path in all environments.
4. Add migration versioning (table + numbered migrations).
5. Add basic metrics: rooms count, connections, queue size, DB write errors.
6. If declaring Redis support: add `redis` + `@socket.io/redis-adapter` as optional/peer deps and document install.

### Long-term / when to leave SQLite

SQLite remains acceptable while:

- Single game-server instance
- Write load is auth + end-of-match (not per-action)
- Operator can back up one file
- User count is friends/small beta scale

Migrate (Postgres + Redis + shared matchmaking) when:

- Need multiple server instances for capacity or HA
- Need durable Career on hosts without reliable disk
- Need richer match history / analytics queries at scale
- Need zero-downtime deploys without dropping live rooms (harder; needs shared room state)

### Before larger public launch

- Persistent DB + backups + restore drill  
- Fix matchmaking wiring + rating bug  
- Load-test single instance (sockets + rooms) — none in repo today  
- Redis (or refuse multi-instance)  
- Observability and alerting on `/health/ready`  
- Secrets rotation plan for `JWT_SECRET`

---

## Appendix A — File map (database / infra)

| Path | Role |
|------|------|
| `packages/database/src/client.ts` | Open DB, WAL, default path |
| `packages/database/src/schema.ts` | DDL + arenas |
| `packages/database/src/migrations.ts` | Idempotent ALTER + casual/friends DDL |
| `packages/database/src/users.ts` | User CRUD / ratings / leaderboard |
| `packages/database/src/sessions.ts` | Session rows |
| `packages/database/src/matches.ts` | Match history |
| `packages/database/src/casualSessions.ts` | Friends session persist |
| `packages/database/src/friends.ts` | Friend graph |
| `packages/database/src/rating.ts` | Elo/trophy/matchmaking math |
| `apps/server/src/server.ts` | Process entry, CORS, Redis init |
| `apps/server/src/serverFactory.ts` | Express + Socket.IO + DB init |
| `apps/server/src/rooms.ts` | Room lifecycle |
| `apps/server/src/stores/*` | In-memory / Redis room store |
| `apps/server/src/redisClient.ts` / `redisAdapter.ts` | Optional Redis |
| `apps/server/src/career/*` | Career queue, rooms, sockets, HTTP |
| `apps/server/src/auth/*` | JWT + REST auth |
| `apps/server/src/casual/*` | Casual persist + stats API |
| `apps/server/src/friends/*` | Friends API + presence |
| `apps/web/lib/serverUrl.ts` | Client → server origin |
| `apps/web/store/authStore.ts` | JWT in localStorage |
| `apps/web/vercel.json` | Vercel monorepo build |
| `render.yaml` / `render.free.yaml` | Render blueprints |
| `.env.example`, `apps/server/.env.example` | Env documentation |
| `docs/GAME_SERVER_DEPLOY.md` | Deploy guide |
| `docs/RENDER_FREE_DEPLOYMENT_PREP.md` | Free-tier constraints |
| `docs/DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md` | Why not Vercel for sockets |

## Appendix B — Schema creation path (exact)

```
createKouppiServer()
  → getDatabase()
      → mkdir data dir
      → new better-sqlite3(path)
      → PRAGMA journal_mode=WAL
      → exec SCHEMA_SQL          // users, matches, sessions
      → runMigrations()
          → ALTER users … casual_* if missing
          → exec CASUAL_SCHEMA_SQL
          → exec FRIENDS_SCHEMA_SQL
```

## Appendix C — Backup / multi-instance / security checklist answers

| Question | Answer |
|----------|--------|
| Backup process in repo? | **No** |
| Easy restore? | Copy SQLite file (+ `-wal`/`-shm` if hot) into `DATABASE_PATH` and restart |
| Migration versioning? | Idempotent DDL only — **gap** |
| Two server instances today? | **No** (shared memory rooms/queue; Redis incomplete + undeclared deps; queue never shared) |
| Shared state missing for HA? | Live rooms, timers, matchmaking queue, (presence without Redis) |
| JWT handling? | HS256-style secret; 7d expiry; default dev secret if unset |
| DB path exposure? | Not served by Express static; risk is host misconfiguration |
| Admin access? | No admin SQL API found |

## Appendix D — Unknowns (explicit)

| Unknown | Why |
|---------|-----|
| Exact production Render plan / whether disk is actually mounted on the live service | Not observable from repo alone; blueprints show intent |
| Whether Redis is currently configured in any live environment | No committed secrets; code path optional |
| Measured max CCU / rooms | **No benchmarks in repository** |
| Whether integration test `careerQueueIntegration` currently passes on CI | Wiring gap suggests it may hang/fail unless callback set elsewhere at runtime (not found) |
| Which of the multiple local `kouppi.db` copies is “the” active one for a given developer | Depends on cwd when server started |

---

*End of main audit report.*
