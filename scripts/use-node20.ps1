# Use the repo's Node 20 toolchain for local KOUPPI work.
# Your system may have Node 25+, which breaks better-sqlite3 native bindings.
#
# Usage (from repo root, in PowerShell):
#   . .\scripts\use-node20.ps1
#   pnpm --filter @kouppi/server dev
#   pnpm --filter @kouppi/web dev

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $repoRoot ".tools\node-v20.19.0-win-x64"

if (-not (Test-Path (Join-Path $tools "node.exe"))) {
  Write-Error "Bundled Node 20 not found at $tools. Install Node.js 20 LTS from https://nodejs.org/ instead."
}

$npmGlobal = Join-Path $env:APPDATA "npm"
$env:Path = "$tools;$npmGlobal;" + $env:Path

Write-Host "KOUPPI toolchain active:"
Write-Host "  node  $(node -v)  (ABI $(node -p process.versions.modules))"
Write-Host "  pnpm  $(pnpm -v)"
