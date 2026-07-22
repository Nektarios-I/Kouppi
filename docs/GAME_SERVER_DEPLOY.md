# Game server deployment (apps/server)

The Socket.IO game server **cannot run on Vercel**. Deploy it to a persistent Node host, then point the Vercel frontend at it with `NEXT_PUBLIC_SERVER_URL`.

See also: [DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md](./DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md)

## Live production wiring (verified 2026-07-22)

| Piece | Value |
|-------|--------|
| Frontend | `https://kouppi-web-nektarios-is-projects.vercel.app` |
| Game server (Render free) | `https://kouppi-server-free.onrender.com` (`GET /health/ready` → `database: true`) |

### Required env (Career will not create tables without both)

**Vercel → Project → Settings → Environment Variables (Production):**

```text
NEXT_PUBLIC_SERVER_URL=https://kouppi-server-free.onrender.com
```

Then **Redeploy** the frontend (build-time inline). Without this, the browser cannot reach Socket.IO / Career APIs.

**Render → kouppi-server-free → Environment:**

```text
CORS_ORIGIN=https://kouppi-web-nektarios-is-projects.vercel.app,https://kouppi-web.vercel.app
```

No trailing slashes. Include every Vercel host you use. A CORS allow-list that only has `https://kouppi-web.vercel.app` blocks the real production site.

### Optional

- Disable Vercel **Deployment Protection** (SSO) on Production if public players should open the site without a Vercel login.
- Free Render sleeps when idle — first request after sleep can take 30–60s; wake via `/health/ready` first.

## Architecture

| Component | Host | Env vars |
|-----------|------|----------|
| Next.js frontend (`apps/web`) | Vercel | `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SITE_URL` |
| Game server (`apps/server`) | Render / Railway / Fly / VPS | `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `DATABASE_PATH`, optional `REDIS_URL` |

## Build and start commands

From repository root:

```bash
pnpm install --frozen-lockfile
pnpm exec turbo build --filter=@kouppi/server
node apps/server/dist/server.js
```

Health check: `GET /health/ready` on the server port.

## Render (Blueprint)

**Free demo/dev:** [`render.free.yaml`](../render.free.yaml) — Free instance, ephemeral `/tmp/kouppi.db`, no disk. See [RENDER_FREE_DEPLOYMENT_PREP.md](./RENDER_FREE_DEPLOYMENT_PREP.md).

**Production (paid + disk):** [`render.yaml`](../render.yaml). Manual steps:

1. Connect the GitHub repo in [Render Dashboard](https://dashboard.render.com).
2. Create a **Web Service** from `render.yaml` (or import the blueprint).
3. Set secrets in Render: `JWT_SECRET`, mount `DATABASE_PATH` on a persistent disk.
4. Set `CORS_ORIGIN` to your Vercel production URL (and preview URL if needed).
5. Copy the Render service HTTPS URL (e.g. `https://kouppi-server.onrender.com`).
6. In **Vercel → Project → Environment Variables**, set:
   - `NEXT_PUBLIC_SERVER_URL` = Render HTTPS origin (no trailing slash)
7. Redeploy the Vercel frontend (Next.js inlines `NEXT_PUBLIC_*` at build time).

## Vercel checklist

- [ ] `NEXT_PUBLIC_SERVER_URL` set for Production (and Preview if testing multiplayer on previews)
- [ ] Root Directory = `apps/web`, monorepo “include source outside root” enabled
- [ ] Build passes `pnpm install --frozen-lockfile` (see `apps/web/vercel.json`)

## CORS

Server reads `CORS_ORIGIN` in `apps/server/src/server.ts` and passes it to Socket.IO (`serverFactory.ts`). Set it to the exact frontend origin(s) users load in the browser.

## Scaling note

Without `REDIS_URL`, rooms, career matchmaking queue, and friend presence are **single-process in-memory**. Run **one** server instance, or configure Redis before scaling horizontally.

### Redis honesty (REDIS-PKG-001)

| Layer | With `REDIS_URL` | Without |
|-------|------------------|---------|
| Socket.IO adapter | Multi-instance pub/sub (optional deps `redis` + `@socket.io/redis-adapter`) | Single process |
| Career matchmaking queue | Still **in-memory** on each process | In-memory |
| Friend presence / room store | See server docs / Redis room store if enabled | In-memory |

**Do not** run multiple Render/Fly instances for Career matchmaking until the queue is Redis-backed. Optional packages are declared under `apps/server` `optionalDependencies` so installs stay light when Redis is unused.

### JWT sessions (JWT-SESS-001)

- Production **requires** `JWT_SECRET` (server refuses to start auth without it).
- JWTs include `sid`; `requireAuth` validates the row in `sessions`. Logout deletes the session (client should call `POST /api/auth/logout`).

### SQLite backups (BACKUP-001)

On the host that mounts persistent disk:

```bash
DATABASE_PATH=/var/data/kouppi.sqlite ./scripts/backup-sqlite.sh
# Windows:
# .\scripts\backup-sqlite.ps1 -DatabasePath "D:\data\kouppi.db"
```

Schedule via cron / Render cron / Task Scheduler. Free-tier `/tmp` DBs need no backup — they are wiped on restart (see CAREER-DB-001).

## Verify production

1. Open `https://<server>/health/ready` — expect JSON `{ ok: true, ... }`.
2. Open Vercel lobby — connection banner should show **Connected** (not localhost / websocket error).
3. Browser devtools → Network → WS — handshake to `wss://<server>/socket.io/`.
