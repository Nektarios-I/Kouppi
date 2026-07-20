# BACKUP-001: Copy SQLite DB (+ WAL/SHM) to a stamped backup folder.
# Usage:
#   $env:DATABASE_PATH = "C:\...\kouppi.db"; .\scripts\backup-sqlite.ps1
#   .\scripts\backup-sqlite.ps1 -DatabasePath "C:\...\kouppi.db"

param(
  [string]$DatabasePath = $env:DATABASE_PATH
)

if (-not $DatabasePath) {
  Write-Error "Set DATABASE_PATH or pass -DatabasePath"
  exit 1
}
if (-not (Test-Path $DatabasePath)) {
  Write-Error "Database file not found: $DatabasePath"
  exit 1
}

$dir = Split-Path -Parent (Resolve-Path $DatabasePath)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $dir "backups\$stamp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Copy-Item $DatabasePath $dest
$wal = "$DatabasePath-wal"
$shm = "$DatabasePath-shm"
if (Test-Path $wal) { Copy-Item $wal $dest }
if (Test-Path $shm) { Copy-Item $shm $dest }

Write-Host "Backup written to $dest"
Get-ChildItem $dest
