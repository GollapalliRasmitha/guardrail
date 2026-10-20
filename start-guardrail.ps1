# GuardRail - start everything locally.
# Easiest: double-click "Start GuardRail.bat". Or from the guardrail folder:
#   powershell -ExecutionPolicy Bypass -File .\start-guardrail.ps1
#
# What it does:
#   1. checks Docker Desktop and Node are installed (starts Docker Desktop if needed)
#   2. creates .env with random local keys (first run only)
#   3. starts Postgres in Docker (port 5434)
#   4. installs Node packages (when package-lock.json changed)
#   5. applies database migrations
#   6. opens one window running GuardRail on http://localhost:3100

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host ""; Write-Host "X $text" -ForegroundColor Red; exit 1 }
function RandomKey() {  # 32 random bytes as base64
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# --- 1. Tools ---------------------------------------------------------------
Step "Checking tools"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "Docker Desktop is not installed. Get it from https://www.docker.com/products/docker-desktop/" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is not installed. Get the LTS version from https://nodejs.org/" }
Write-Host "Node $(node --version)"

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop is not running. Starting it..."
    $dockerApp = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerApp) { Start-Process $dockerApp }
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 3
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
    }
    if ($LASTEXITCODE -ne 0) { Fail "Docker Desktop didn't start. Open it by hand, wait for 'Engine running', then run this again." }
}

if (Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue) {
    Fail "Port 3100 is already in use (is GuardRail already open in another window?). Close it and run this again."
}

# --- 2. .env ------------------------------------------------------------------
Step "Checking .env"
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
    # .env.example has names only. Fill in local values: the Docker database and fresh random keys.
    $text = Get-Content (Join-Path $root ".env.example") -Raw
    $text = $text -replace "(?m)^DATABASE_URL=\r?$", "DATABASE_URL=postgres://guardrail:guardrail@localhost:5434/guardrail"
    $text = $text -replace "(?m)^APP_URL=\r?$", "APP_URL=http://localhost:3100"
    $text = $text -replace "(?m)^ENCRYPTION_KEY=\r?$", "ENCRYPTION_KEY=$(RandomKey)"
    $text = $text -replace "(?m)^HASH_SECRET=\r?$", "HASH_SECRET=$(RandomKey)"
    [System.IO.File]::WriteAllText($envFile, $text)  # UTF-8 without BOM
    Write-Host "Created .env with random local keys. (It is never committed to git.)"
} else {
    Write-Host ".env found."
}
# Settings added in later stages: give any that are missing or empty a fresh random value.
# (Keeps an older .env working without editing it by hand.)
$lines = [System.Collections.Generic.List[string]](Get-Content $envFile)
foreach ($name in "INGEST_SECRET_HOMEHAAT", "INGEST_SECRET_OPPORA") {
    if ($lines | Where-Object { $_ -match "^$name=\S" }) { continue }
    $lines.RemoveAll([Predicate[string]] { param($l) $l -match "^$name=\s*$" }) | Out-Null
    $lines.Add("$name=$(RandomKey)")
    Write-Host "Added $name to .env (random value)."
}
[System.IO.File]::WriteAllText($envFile, ($lines -join "`n") + "`n")

# --- 3. Postgres ----------------------------------------------------------------
Step "Starting Postgres (Docker, port 5434)"
docker compose up -d db
if ($LASTEXITCODE -ne 0) { Fail "Docker couldn't start Postgres. Is Docker Desktop running?" }
for ($i = 0; $i -lt 40; $i++) {
    $health = docker inspect --format "{{.State.Health.Status}}" guardrail-db 2>$null
    if ($health -eq "healthy") { break }
    Start-Sleep -Seconds 2
}
if ($health -ne "healthy") { Fail "Postgres didn't become ready. Check Docker Desktop for errors." }
Write-Host "Postgres is ready."

# --- 4. Packages ----------------------------------------------------------------
Step "Installing Node packages"
$stamp = Join-Path $root "node_modules\.package-lock.json"
if (-not (Test-Path $stamp) -or ((Get-Item (Join-Path $root "package-lock.json")).LastWriteTime -gt (Get-Item $stamp).LastWriteTime)) {
    npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed. Read the message above." }
} else {
    Write-Host "Packages are up to date."
}

# --- 5. Migrations --------------------------------------------------------------
Step "Updating the database"
npm run --silent db:migrate
if ($LASTEXITCODE -ne 0) { Fail "Database migration failed. Read the message above." }

# --- 6. Start ---------------------------------------------------------------------
Step "Starting GuardRail on http://localhost:3100"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$host.UI.RawUI.WindowTitle = 'GuardRail (port 3100)'; npm run dev"
Write-Host ""
Write-Host "GuardRail is starting in a new window. Open http://localhost:3100 in a few seconds." -ForegroundColor Green
Write-Host "First time? In this folder run:  npm run admin:create   (to make your account)"
