# Render Free Web Service — Deployment Preparation

**Date:** 2026-07-17  
**Scope:** Prepare `apps/server` for a **Render Free** Web Service (demo/dev). Frontend remains on Vercel.

**Production frontend URL:** `https://kouppi-web-nektarios-is-projects.vercel.app`

---

## 1. Node.js and pnpm versions

| Source | Version |
|--------|---------|
| `.nvmrc` | **Node 20** |
| Root `package.json` `packageManager` | **pnpm 10.12.4** |
| GitHub Actions `.github/workflows/ci.yml` | Node 20, pnpm 10.12.4 |

Render should use **Node 20** runtime (default for `runtime: node` tracks current LTS).

---

## 2. Official build command (monorepo root)

```bash
corepack enable && corepack prepare pnpm@10.12.4 --activate && pnpm install --frozen-lockfile && pnpm exec turbo build --filter=@kouppi/server
```

Turbo builds `@kouppi/database`, `@kouppi/protocol`, `@kouppi/game-core`, then `@kouppi/server` (see `turbo.json` `dependsOn: ["^build"]`).

**Root directory:** repository root (not `apps/server`). The start command runs `node apps/server/dist/server.js` from repo root.

---

## 3. Official start command

```bash
node apps/server/dist/server.js
```

Equivalent to `pnpm --filter @kouppi/server start` when cwd is `apps/server`.

---

## 4. Does `render.yaml` work for Free?

**No.** The committed `render.yaml` is for **paid** deployment:

| Setting | `render.yaml` | Free requirement |
|---------|---------------|------------------|
| `plan` | `starter` (paid) | `free` |
| `disk` | 1 GB mount at `/var/data` | **Not supported on Free** |
| `DATABASE_PATH` | `/var/data/kouppi.sqlite` | Ephemeral path required |
| `region` | `frankfurt` | `ohio` recommended (closer to Vercel `iad1`) |
| `PORT` | hardcoded `4000` | **Must not override** — Render injects `PORT` |

**Safe alternative:** [`render.free.yaml`](../render.free.yaml) at repository root.

---

## 5. Why two blueprint files?

| File | Purpose |
|------|---------|
| `render.yaml` | Paid Render Web Service + persistent disk for production SQLite |
| `render.free.yaml` | **Free** demo instance, no disk, ephemeral `/tmp/kouppi.db` |

Do not delete `render.yaml` — it documents the production path. Use `render.free.yaml` for this task.

---

## 6. Runtime environment variables (`apps/server`)

| Variable | Required | Example / format | Secret? | Free tier |
|----------|----------|------------------|---------|-----------|
| `PORT` | **Injected by Render** | Render sets dynamically (e.g. `10000`) | No | Yes — **do not set manually on Render** |
| `NODE_ENV` | Recommended | `production` | No | Yes |
| `CORS_ORIGIN` | **Required in production** | `https://kouppi-web-nektarios-is-projects.vercel.app` or comma-separated with `http://localhost:3000` | No | Yes |
| `JWT_SECRET` | **Required in production** | 32+ random bytes (base64 or hex) | **Yes** | Yes |
| `DATABASE_PATH` | Recommended | `/tmp/kouppi.db` on Free | No | Yes — **ephemeral only** |
| `REDIS_URL` | Optional | `redis://...` | Often yes | Optional (not needed for single free instance) |

**Code references:**

- `PORT` — `apps/server/src/server.ts` (`process.env.PORT ? Number(process.env.PORT) : 4000`)
- `CORS_ORIGIN` — `apps/server/src/server.ts` → `parseCorsOrigins()` → Express + Socket.IO
- `JWT_SECRET` — `apps/server/src/auth/jwt.ts` (defaults to dev secret if unset — **set in production**)
- `DATABASE_PATH` — `packages/database/src/client.ts` (`getDefaultDbPath()`)
- `REDIS_URL` — `apps/server/src/redisClient.ts`, `redisAdapter.ts`
- `NODE_ENV` — `serverFactory.ts` (`websocketOnly` in production)

---

## 7. Frontend Socket.IO URL variable

| Variable | Host | Purpose |
|----------|------|---------|
| **`NEXT_PUBLIC_SERVER_URL`** | **Vercel** | Public HTTPS origin of the Render game server |

Resolved in `apps/web/lib/serverUrl.ts` → used by `remoteGameStore.ts`, `careerLobbyStore.ts`, `friendsStore.ts`, etc.

Optional: `NEXT_PUBLIC_SITE_URL` — metadata/sitemap only (`layout.tsx`, `sitemap.ts`, `robots.ts`).

---

## 8. Socket.IO path, transport, CORS, health

| Item | Value | Evidence |
|------|-------|----------|
| Socket.IO path | `/socket.io/` (default) | No custom `path` in client or server |
| Client transport (multiplayer) | `websocket` only | `apps/web/store/remoteGameStore.ts` |
| Client transport (career) | `websocket`, `polling` | `apps/web/store/careerLobbyStore.ts` |
| Server transport (production) | `websocket` only | `serverFactory.ts` when `NODE_ENV=production` |
| CORS | `CORS_ORIGIN` env, comma-separated supported | `apps/server/src/config/corsOrigins.ts` |
| Production CORS default | Empty list if unset (blocks browsers) | `parseCorsOrigins()` — not `*` in production |
| Health (liveness) | `GET /health` | `serverFactory.ts` |
| Health (readiness) | `GET /health/ready` | `serverFactory.ts` — used by Render `healthCheckPath` |

**WSS:** Browser uses `https://<render-host>` → Socket.IO upgrades to `wss://<render-host>/socket.io/`.

---

## 9. `PORT` binding

Yes. `apps/server/src/server.ts`:

```typescript
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(port, ...);
```

Render Free injects `PORT`; the server listens on it correctly.

---

## 10. Temporary database path `/tmp/kouppi.db`

**Validated against code:**

- `packages/database/src/client.ts` reads `process.env.DATABASE_PATH`.
- Parent directory is created with `fs.mkdirSync(dir, { recursive: true })`.
- On Linux (Render), `/tmp` exists and is writable.
- Schema is applied on first connect: `db.exec(SCHEMA_SQL)` + `runMigrations(db)`.

**Free tier warning:** File is deleted on redeploy/restart. Treat as **demo data only**.

---

## 11. Automatic schema creation

Yes. `getDatabase()` runs `SCHEMA_SQL` and migrations on first open (`packages/database/src/client.ts`).

---

## 12. `better-sqlite3` / native modules on Render

- `better-sqlite3` and `bcrypt` are native addons compiled at `pnpm install`.
- Root `package.json` includes `pnpm.onlyBuiltDependencies` for `better-sqlite3`, `bcrypt`, `esbuild` so pnpm 10 allows install scripts on Render.
- Render Node 20 images include build tools for native compilation during install.

**Risk:** If install scripts are blocked, server starts but Career/auth DB features fail (`database: false` in `/health/ready`).

---

## 13. Likely causes of “websocket error” after deploy

| Cause | Check |
|-------|-------|
| `NEXT_PUBLIC_SERVER_URL` not set on Vercel | Lobby shows diagnostic from `serverUrl.ts` |
| Vercel not redeployed after env change | `NEXT_PUBLIC_*` inlined at build time |
| Wrong URL format | Must be `https://host` — no trailing slash, no `/health/ready` |
| `CORS_ORIGIN` missing/wrong on Render | Browser blocks cross-origin WebSocket |
| Render service sleeping (Free) | First request after 15 min idle → 30–60s cold start |
| Server not deployed / build failed | `GET https://<host>/health/ready` |
| `JWT_SECRET` unset | Auth/career fail; casual multiplayer may still connect |

---

## Blueprint selection

| Use case | File |
|----------|------|
| **This task (Free demo)** | `render.free.yaml` |
| Production with persistent SQLite | `render.yaml` (paid + disk) |

See also: [GAME_SERVER_DEPLOY.md](./GAME_SERVER_DEPLOY.md)
