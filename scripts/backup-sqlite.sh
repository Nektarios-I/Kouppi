#!/usr/bin/env bash
# BACKUP-001: Copy SQLite DB (+ WAL/SHM) to a stamped backup folder.
# Usage:
#   DATABASE_PATH=/var/data/kouppi.sqlite ./scripts/backup-sqlite.sh
#   ./scripts/backup-sqlite.sh /path/to/kouppi.db

set -euo pipefail

SRC="${1:-${DATABASE_PATH:-}}"
if [[ -z "${SRC}" ]]; then
  echo "Usage: DATABASE_PATH=/path/to/db.sqlite $0" >&2
  echo "   or: $0 /path/to/db.sqlite" >&2
  exit 1
fi

if [[ ! -f "${SRC}" ]]; then
  echo "Database file not found: ${SRC}" >&2
  exit 1
fi

DIR="$(cd "$(dirname "${SRC}")" && pwd)"
BASE="$(basename "${SRC}")"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${DIR}/backups/${STAMP}"
mkdir -p "${DEST}"

cp -a "${SRC}" "${DEST}/"
[[ -f "${SRC}-wal" ]] && cp -a "${SRC}-wal" "${DEST}/" || true
[[ -f "${SRC}-shm" ]] && cp -a "${SRC}-shm" "${DEST}/" || true

echo "Backup written to ${DEST}"
ls -la "${DEST}"
