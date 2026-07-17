# Game server deployment (apps/server)

The Socket.IO game server **cannot run on Vercel**. Deploy it to a persistent Node host, then point the Vercel frontend at it with `NEXT_PUBLIC_SERVER_URL`.

See also: [DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md](./DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md)

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

Without `REDIS_URL`, rooms, career matchmaking queue, and friend presence are **single-process in-memory**. Run one server instance or configure Redis before scaling horizontally.

## Verify production

1. Open `https://<server>/health/ready` — expect JSON `{ ok: true, ... }`.
2. Open Vercel lobby — connection banner should show **Connected** (not localhost / websocket error).
3. Browser devtools → Network → WS — handshake to `wss://<server>/socket.io/`.
