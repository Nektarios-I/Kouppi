# KOUPPI Scaling Assessment

**Date:** 2026-07-19  
**Basis:** Architecture in `kouppi/` codebase and deploy configs.  
**No direct benchmark exists in the repository.** Numbers below are conservative engineering estimates, not measured capacity.

Companion: [`DATABASE_AND_INFRA_AUDIT.md`](./DATABASE_AND_INFRA_AUDIT.md).

---

## 1. Current scaling model

| Layer | Model today |
|-------|-------------|
| Frontend | Horizontally scaled on Vercel (static/SSR). Does **not** hold multiplayer authority. |
| Game server | **Single Node process** expected (`apps/server`). One HTTP + Socket.IO listener. |
| Database | **One SQLite file** opened by that process (`better-sqlite3`, WAL). |
| Rooms / timers | In-process Maps (`InMemoryRoomStore`) unless Redis room store is active. |
| Matchmaking queue | **In-process Map only** (`career/queue.ts`) — never Redis-backed in current code. |
| Friend presence | In-memory or Redis TTL if `REDIS_URL` works. |
| Horizontal scaling | **Not supported** for correct multiplayer without shared state. Docs (`GAME_SERVER_DEPLOY.md`) say: run one instance or configure Redis first. |

### Is multi-instance supported?

**No, not safely today**, even if you set `REDIS_URL`:

1. Redis packages (`redis`, `@socket.io/redis-adapter`) are **not** in `apps/server/package.json` — dynamic import fails unless installed manually on the host.
2. Career **queue** remains a process-local `Map`.
3. Career waiting rooms / auto-start timers remain process-local.
4. Room Redis store helps lobby listing/hydration but timers and authoritative mutation paths are still process-coupled.

**Verdict:** Scale-up = bigger single VM / more RAM-CPU on one instance. Scale-out = requires new shared matchmaking + durable room coordination work.

---

## 2. Known architectural bottlenecks

Distinguish these carefully:

| Concept | What limits it in KOUPPI |
|---------|---------------------------|
| **DB storage capacity** | Disk size (1 GB Render disk in `render.yaml`). Row growth is slow (users, matches, friends). Unlikely to fill first. |
| **DB concurrency** | SQLite single-writer. Writes are **infrequent** (login, match end, friend actions) — not per betting action. |
| **App/server concurrency** | One Node event loop; CPU for game reducer + JSON broadcast. |
| **Active multiplayer room capacity** | In-memory rooms + per-room timers + fan-out emits to Socket.IO rooms. |
| **Connected socket capacity** | Engine connections on one process; Render instance size; free-tier sleep. |
| **Durable persistence** | SQLite file durability (path + disk). Free `/tmp` is not durable. |

### Bottleneck detail

1. **SQLite single writer**  
   Real risk only if many concurrent Career match completions / auth storms hit the same file. Casual per-tick game actions do **not** hit SQLite.

2. **File-based persistence**  
   Single host affinity. No built-in replica. Free tier path loses data. No backup automation.

3. **In-memory room state**  
   Restart = all live games gone. Primary multiplayer failure mode under deploys.

4. **Socket.IO multi-instance**  
   Without Redis adapter, sticky sessions alone still break room locality. With adapter, queue/career still broken across nodes.

5. **Render Free**  
   Spins down, cold starts, ephemeral disk — bad for always-on sockets and Career data (`RENDER_FREE_DEPLOYMENT_PREP.md`).

6. **Matchmaking wiring gap** (functional, not scale)  
   Queue callback/`runMatchmaking` not wired in production entry as of this audit — capacity is moot if matches never form correctly.

---

## 3. Practical capacity estimate

Assumptions baked into estimates:

- One paid Render/VPS Node instance, persistent SQLite  
- Redis **off**  
- Mix of casual rooms (2–8 players)  
- Career writes only at game end  
- No pathological broadcast storms  
- **No repo benchmarks**

| Category | Concurrent users (order of magnitude) | What likely degrades first |
|----------|--------------------------------------|----------------------------|
| **Solo / local testing** | 1–5 | Developer machine / Node native modules |
| **Friends testing** | ~5–20 sockets, few rooms | Deploy misconfig (CORS, `NEXT_PUBLIC_SERVER_URL`), free-tier sleep if used |
| **Small beta** | ~20–80 concurrent sockets; ~5–15 active rooms | Server restarts dropping rooms; single-process CPU under many timers; ops (no metrics) |
| **Low hundreds concurrent** | ~100–300 sockets | Socket fan-out + event-loop latency; memory for room state; deploy downtime pain; SQLite busy spikes if many matches end together |
| **Beyond that** | 500+ | Need multi-instance → currently **architecturally blocked**; must add Redis adapter + shared queue/rooms + likely move off single-file SQLite for HA |

### DB file size vs multiplayer throughput

- **File size scale:** Thousands to tens of thousands of users/matches is still a tiny SQLite file. Storage is not the binding constraint for early public use.
- **Throughput scale:** Live multiplayer is bound by **one Node + memory rooms + WebSocket fan-out**, not by SQLite MB on disk.

### Write frequency (why SQLite is OK early)

| Event | Hits SQLite? |
|-------|----------------|
| Fold/call/raise each turn | No |
| Room create/join | No |
| Queue tick | No |
| Login/register | Yes |
| Career game end | Yes (several updates + match row) |
| Casual friends room close | Yes (if logged-in players) |
| Friend request | Yes |

---

## 4. Failure modes

| Failure | Cause | User-visible effect |
|---------|-------|---------------------|
| DB locked / `SQLITE_BUSY` | Concurrent writers (app + manual edit, or rare write burst) | Auth/Career API errors; multiplayer may continue |
| Server restart data loss | In-memory rooms/queue | All tables vanish; clients disconnect |
| Ephemeral disk loss | Free `/tmp` or missing mount | Accounts/ratings wiped |
| Multi-instance room desync | Two processes without shared room/queue | Split lobbies, failed joins, ghost rooms |
| Reconnect failure after restart | Grace tokens valid client-side but room gone | “Room not found” |
| JWT secret change | New deploys with rotated secret without notice | Mass logout |
| Cold start / sleep (Free) | Render free policy | Long connect failures; lobby errors |
| Matchmaking silent drop | `tryFindMatch` removes queue entries without `handleMatchFound` if callback unset | Players leave queue with no match UI |
| Rating corruption | Absolute rating passed as delta into `updateRatingAndTrophies` | Inflated ratings after Career games |

---

## 5. Scaling path (highest leverage first)

### Phase A — Make single-instance trustworthy (do first)

1. Persistent disk + absolute `DATABASE_PATH`  
2. Automated SQLite backups + restore drill  
3. Fix matchmaking wiring + rating update bug  
4. Metrics on `/health/ready` (connections, rooms, queue size) + uptime alerts  
5. Stay on **one** server instance  

**Leverage:** Unlocks friends testing and small beta without changing architecture.

### Phase B — Raise single-box capacity

1. Larger Render/VPS plan (CPU/RAM)  
2. Tune Socket.IO / connection limits  
3. Load-test scripts (not in repo yet) for N sockets × M rooms  
4. Optional: reduce broadcast payload size / snapshot frequency if profiling shows need  

**Leverage:** Pushes “low hundreds” further on one box.

### Phase C — When SQLite is still acceptable

Keep SQLite while:

- One writer process owns the file  
- Writes remain end-of-match / auth class  
- Operator accepts file restore as DR  
- No multi-region write need  

### Phase D — Scale-out prerequisites (before public large launch)

| Need | Technology |
|------|------------|
| Multi-instance Socket.IO | Redis adapter (`REDIS_URL` + install deps) |
| Shared rooms | Redis (or other) room store + timer ownership strategy |
| Shared matchmaking | Redis queue / dedicated matchmaker service |
| Durable Career HA | **Postgres** (or SQLite on networked volume with caution) |
| Presence | Redis (partially implemented) |
| Assets / large blobs | Object storage if needed later (not used for game state today) |
| Backups | Automated snapshots + tested restore |

### What to fix before larger public launch

1. Single persistent instance with backups  
2. Functional Career matchmaking + correct rating writes  
3. Explicit “one instance only” ops policy until Phase D done  
4. Load test evidence (create it — none in repo)  
5. Plan Postgres + Redis when approaching concurrent hundreds or needing HA deploys without kicking all rooms  

---

## 6. Suitability snapshot

| Use case | Suitable? | Why |
|----------|-----------|-----|
| Development | **Yes** | Local SQLite + one server matches the design |
| Friends testing | **Yes** (paid/persistent host) | Low concurrency; watch Free-tier footguns |
| Small beta | **Conditionally yes** | Fix P0 Career bugs; persistent DB; expect restart = game wipe |
| Larger public launch | **Not yet** | No HA, no proven CCU, matchmaking/rating issues, no backup automation, scale-out incomplete |

---

*End of scaling assessment.*
