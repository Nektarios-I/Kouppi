# KOUPPI Database Access Guide

Practical guide for inspecting and safely editing the SQLite database used by `@kouppi/database` / `apps/server`.

Companion: [`DATABASE_AND_INFRA_AUDIT.md`](./DATABASE_AND_INFRA_AUDIT.md).

---

## 1. Where the database is located

### Environment variable

| Variable | Effect |
|----------|--------|
| `DATABASE_PATH` | Absolute or relative path to the SQLite file. If unset, defaults to `{process.cwd()}/data/kouppi.db`. |

Defined in: `packages/database/src/client.ts` → `getDefaultDbPath()`.

### Development (exact paths)

| Situation | Path |
|-----------|------|
| Server started with cwd `apps/server` (typical `pnpm --filter @kouppi/server dev`) | `kouppi/apps/server/data/kouppi.db` |
| Absolute example (this machine layout) | `C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\data\kouppi.db` |
| Server started from monorepo root without `DATABASE_PATH` | `kouppi/data/kouppi.db` |
| Accidental runs under package resolution | May create `**/node_modules/**/data/kouppi.db` — **do not use these**; set an absolute `DATABASE_PATH` |

`.gitignore` ignores `apps/server/data/`, `*.db`, `*.db-wal`, `*.db-shm`.

WAL mode creates sidecars next to the main file:

- `kouppi.db` (or `.sqlite`)
- `kouppi.db-wal`
- `kouppi.db-shm`

### Production (configured in repo)

| Deploy blueprint | Path |
|------------------|------|
| `render.free.yaml` (Free) | `/tmp/kouppi.db` — **ephemeral** |
| `render.yaml` (Paid + disk) | `/var/data/kouppi.sqlite` (disk mount `/var/data`, 1 GB) |

Confirm live value in the Render dashboard env vars (`DATABASE_PATH`). The live service may differ from blueprints if changed manually — **unknown from the repo alone**.

---

## 2. How to back it up

### Safe approach (recommended)

1. Prefer stopping the game server briefly, **or**
2. Copy while running using SQLite backup API / a tool that checkpoints WAL.

**Minimum file set to preserve:** main DB file **plus** `-wal` and `-shm` if present (especially if the server is running).

### Windows PowerShell (local)

```powershell
# Adjust path if your DATABASE_PATH differs
$DbDir = "C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\data"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $DbDir "backups\$Stamp"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Copy-Item "$DbDir\kouppi.db" $BackupDir -ErrorAction SilentlyContinue
Copy-Item "$DbDir\kouppi.db-wal" $BackupDir -ErrorAction SilentlyContinue
Copy-Item "$DbDir\kouppi.db-shm" $BackupDir -ErrorAction SilentlyContinue

Get-ChildItem $BackupDir
```

### Bash (local or Linux host)

```bash
DB_DIR="$(pwd)/apps/server/data"   # or /var/data on Render paid
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DB_DIR/backups/$STAMP"
cp -a "$DB_DIR"/kouppi.db* "$DB_DIR/backups/$STAMP/" 2>/dev/null || true
# Paid Render filename:
# cp -a /var/data/kouppi.sqlite* "$DB_DIR/backups/$STAMP/"
ls -la "$DB_DIR/backups/$STAMP"
```

### Hot backup with sqlite3 (best if server must stay up)

```bash
sqlite3 /path/to/kouppi.db "VACUUM INTO '/path/to/kouppi-backup-$STAMP.db';"
```

Or:

```bash
sqlite3 /path/to/kouppi.db ".backup '/path/to/kouppi-backup.db'"
```

### Restore

1. Stop `apps/server`.
2. Replace the live file(s) with the backup (match the configured `DATABASE_PATH` name).
3. Remove stale `-wal`/`-shm` if restoring a self-contained backup from `.backup` / `VACUUM INTO`.
4. Start the server; schema migrations are idempotent on open.

**Repo helpers (BACKUP-001):** [`scripts/backup-sqlite.sh`](../scripts/backup-sqlite.sh) and [`scripts/backup-sqlite.ps1`](../scripts/backup-sqlite.ps1) — copy DB + WAL/SHM into a stamped folder. Schedule them on the host; there is no in-app cron.

---

## 3. How to inspect it

### Option A — DB Browser for SQLite (GUI, recommended on Windows)

1. Install [DB Browser for SQLite](https://sqlitebrowser.org/).
2. File → Open → select `kouppi.db` or `kouppi.sqlite`.
3. Prefer opening a **copy** if the server is running.
4. Browse Data / Execute SQL tabs.

### Option B — sqlite3 CLI

Install sqlite3 if needed (Windows: download from sqlite.org, or `winget search sqlite`).

**PowerShell:**

```powershell
cd C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\data
sqlite3 .\kouppi.db
```

**Bash:**

```bash
sqlite3 apps/server/data/kouppi.db
# or
sqlite3 /var/data/kouppi.sqlite
```

### First commands inside sqlite3

```sql
.tables
.schema users
.schema matches
.schema sessions
.schema casual_sessions
.schema casual_session_players
.schema friendships
.schema friend_requests

SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS matches FROM matches;
SELECT COUNT(*) AS sessions FROM sessions;
SELECT COUNT(*) AS casual_sessions FROM casual_sessions;
SELECT COUNT(*) AS friendships FROM friendships;
SELECT COUNT(*) AS friend_requests FROM friend_requests;
```

### Confirm WAL mode

```sql
PRAGMA journal_mode;
PRAGMA foreign_keys;   -- often 0 in this app (not enabled in client.ts)
```

---

## 4. How to edit it safely

### When it is safe

| Situation | Guidance |
|-----------|----------|
| Server stopped | Safest for manual UPDATE/DELETE |
| Server running | Prefer read-only queries; avoid long write transactions |
| Production | Edit only after backup; prefer app APIs for user-facing changes |

### Concurrent writes

- App uses `better-sqlite3` with WAL — readers can coexist with one writer.
- Manual editors + live server both writing can cause `SQLITE_BUSY` or surprises.
- **Stop the server** before bulk edits or schema experiments.

### Example writes (schema-aware)

**Boost bankroll (Career):**

```sql
UPDATE users SET bankroll = 5000 WHERE username = 'alice' COLLATE NOCASE;
```

**Reset trophies carefully (respect arena floors in app logic):**

```sql
UPDATE users SET trophies = 0, highest_trophies = 0, arena = 1 WHERE username = 'alice' COLLATE NOCASE;
```

**Delete expired session rows (harmless housekeeping; JWT still valid until expiry):**

```sql
DELETE FROM sessions WHERE expires_at < (strftime('%s','now') * 1000);
```

**Remove a pending friend request:**

```sql
DELETE FROM friend_requests WHERE id = '<request-uuid>';
```

### Prefer app APIs when possible

| Goal | Prefer |
|------|--------|
| Create account | `POST /api/auth/register` |
| Change avatar | `PATCH /api/profile` (authenticated) |
| Friends | `/api/friends/*` |
| Casual history | written automatically on room close |

There are **no** seed/admin/migration CLI scripts in the repo.

---

## 5. Useful queries

### Top players (leaderboard-style)

```sql
SELECT username, rating, trophies, arena, games_played, games_won, bankroll
FROM users
ORDER BY trophies DESC, rating DESC
LIMIT 25;
```

```sql
SELECT username, rating, trophies
FROM users
ORDER BY rating DESC
LIMIT 25;
```

### Recent career match rows

```sql
SELECT m.id, m.created_at,
       u1.username AS player1, u2.username AS player2,
       uw.username AS winner,
       m.rounds_played, m.duration_seconds
FROM matches m
JOIN users u1 ON u1.id = m.player1_id
JOIN users u2 ON u2.id = m.player2_id
LEFT JOIN users uw ON uw.id = m.winner_id
ORDER BY m.created_at DESC
LIMIT 20;
```

### Career stats for one user

```sql
SELECT username, bankroll, rating, trophies, highest_trophies, arena,
       games_played, games_won, total_earnings,
       casual_games_played, casual_mvp_count,
       datetime(created_at/1000, 'unixepoch') AS created_utc,
       datetime(last_login_at/1000, 'unixepoch') AS last_login_utc
FROM users
WHERE username = 'alice' COLLATE NOCASE;
```

### Casual / friends session history

```sql
SELECT cs.room_code,
       datetime(cs.ended_at/1000, 'unixepoch') AS ended_utc,
       cs.hands_played, cs.biggest_pot, cs.player_count,
       csp.display_name, csp.final_bankroll, csp.is_mvp
FROM casual_session_players csp
JOIN casual_sessions cs ON cs.id = csp.session_id
JOIN users u ON u.id = csp.user_id
WHERE u.username = 'alice' COLLATE NOCASE
ORDER BY cs.ended_at DESC
LIMIT 20;
```

### Friends

```sql
SELECT u.username AS user, f.username AS friend,
       datetime(fs.created_at/1000, 'unixepoch') AS since_utc
FROM friendships fs
JOIN users u ON u.id = fs.user_id
JOIN users f ON f.id = fs.friend_id
ORDER BY fs.created_at DESC
LIMIT 50;
```

```sql
SELECT fr.id, fr.status,
       a.username AS from_user, b.username AS to_user,
       datetime(fr.created_at/1000, 'unixepoch') AS created_utc
FROM friend_requests fr
JOIN users a ON a.id = fr.from_user_id
JOIN users b ON b.id = fr.to_user_id
WHERE fr.status = 'pending';
```

### Orphan / integrity checks

```sql
-- Match players missing users (FK not enforced unless PRAGMA foreign_keys=ON)
SELECT m.id FROM matches m
LEFT JOIN users u1 ON u1.id = m.player1_id
LEFT JOIN users u2 ON u2.id = m.player2_id
WHERE u1.id IS NULL OR u2.id IS NULL;

SELECT csp.session_id, csp.user_id FROM casual_session_players csp
LEFT JOIN users u ON u.id = csp.user_id
WHERE csp.user_id IS NOT NULL AND u.id IS NULL;

SELECT COUNT(*) AS session_rows FROM sessions;
SELECT COUNT(*) AS expired_sessions FROM sessions WHERE expires_at < (strftime('%s','now') * 1000);
```

### What you will **not** find in SQL

Live rooms, matchmaking queue, reconnect timers, Socket.IO connections, friend online presence — those are process memory (or Redis), not SQLite.

---

## 6. What not to do

1. **Do not** edit production DB blindly without a backup.
2. **Do not** change `users.id` without updating all referencing tables (`matches`, `sessions`, `friendships`, `friend_requests`, `casual_session_players`).
3. **Do not** delete `users` casually — will orphan or cascade depending on FK enforcement (currently unreliable without `PRAGMA foreign_keys=ON`).
4. **Do not** assume deleting `sessions` rows logs anyone out — auth is JWT-based; tokens remain valid until expiry or secret rotation.
5. **Do not** edit `password_hash` with plaintext — must be bcrypt hashes as produced by the app.
6. **Do not** rely on Free Render `/tmp/kouppi.db` for real Career data — it disappears on restart.
7. **Do not** open and write the live file from two tools while the server is under load.
8. **Do not** commit `.db` files or secrets to git.
9. **Do not** confuse multiple cwd-created DB copies — always check `DATABASE_PATH` / server startup log: `[Database] Connected to ...`.

### Finding which file the running server uses

Look at server stdout for:

```text
[Database] Connected to <path>
```

Or call `GET /health/ready` and confirm `database: true`, then check host env `DATABASE_PATH`.

---

## Quick reference — tables to open first

1. `users` — accounts & Career progression  
2. `matches` — Career history (1v1-shaped rows)  
3. `casual_sessions` + `casual_session_players` — friends multiplayer history  
4. `friendships` / `friend_requests` — social graph  
5. `sessions` — leftover session tokens (not JWT)

Schema source of truth: `packages/database/src/schema.ts` + `migrations.ts`.
