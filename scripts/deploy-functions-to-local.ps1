# =============================================================================
# deploy-functions-to-local.ps1
#
# Copies all edge functions to the self-hosted Supabase Docker volumes directory.
# Run this script on the Windows machine that hosts your Supabase Docker,
# OR from this machine if you can access the Docker host via a network share.
#
# Usage (run ON the Docker host machine):
#   1. Copy/clone the lapor-citizen-feedback repo to the Docker host
#   2. Open PowerShell and cd to the repo root
#   3. .\scripts\deploy-functions-to-local.ps1
#
#   OR specify the Docker directory path:
#   .\scripts\deploy-functions-to-local.ps1 -DockerDir "C:\path\to\supabase\docker"
#
#   OR specify a network share path (run from THIS machine):
#   .\scripts\deploy-functions-to-local.ps1 -DockerDir "\\192.168.1.19\share\supabase\docker"
# =============================================================================

param(
    [string]$DockerDir = ""
)

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
function Write-Info  { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[ERR]  $msg" -ForegroundColor Red; exit 1 }

# --------------------------------------------------------------------------
# Resolve paths
# --------------------------------------------------------------------------
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent $ScriptDir
$FunctionsSrc = Join-Path $RepoRoot "supabase\functions"

Write-Info "Repo root:     $RepoRoot"
Write-Info "Functions src: $FunctionsSrc"

# --------------------------------------------------------------------------
# Auto-detect Docker directory
# --------------------------------------------------------------------------
if (-not $DockerDir) {
    Write-Info "Auto-detecting Supabase Docker Compose directory..."

    $candidates = @(
        "$HOME\supabase\docker",
        "$HOME\supabase",
        "C:\supabase\docker",
        "C:\supabase",
        "C:\Users\supabase\supabase\docker",
        "D:\supabase\docker"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate "docker-compose.yml")) {
            $DockerDir = $candidate
            break
        }
    }

    if (-not $DockerDir) {
        Write-Host ""
        Write-Host "Could not auto-detect Docker Compose directory." -ForegroundColor Red
        Write-Host "Please run with the -DockerDir parameter:"
        Write-Host '  .\scripts\deploy-functions-to-local.ps1 -DockerDir "C:\path\to\supabase\docker"'
        exit 1
    }
}

$FunctionsDest = Join-Path $DockerDir "volumes\functions"

Write-Info "Docker dir:    $DockerDir"
Write-Info "Functions dest: $FunctionsDest"

# Validate
if (-not (Test-Path $DockerDir)) {
    Write-Err "Docker directory not found: $DockerDir"
}
if (-not (Test-Path (Join-Path $DockerDir "docker-compose.yml"))) {
    Write-Err "No docker-compose.yml found at: $DockerDir"
}

# Create destination if it doesn't exist
New-Item -ItemType Directory -Force -Path $FunctionsDest | Out-Null

# --------------------------------------------------------------------------
# Copy edge functions
# --------------------------------------------------------------------------
$Functions = @(
    "submit-report",
    "fonnte-webhook",
    "infobip-webhook",
    "whatsapp-cloud-webhook",
    "generate-ai-insight",
    "generate-api-key",
    "get-webhook-errors",
    "send-human-reply",
    "extract-report-from-conversation",
    "admin-submit-report",
    "redeem-license",
    "_shared"
)

Write-Host ""
Write-Info "Copying edge functions..."

foreach ($fn in $Functions) {
    $src = Join-Path $FunctionsSrc $fn
    if (Test-Path $src) {
        Copy-Item -Recurse -Force $src $FunctionsDest
        Write-Ok "Copied: $fn"
    } else {
        Write-Warn "Skipped (not found): $fn"
    }
}

# Copy deno.json (shared import map — critical)
$denoJson = Join-Path $FunctionsSrc "deno.json"
if (Test-Path $denoJson) {
    Copy-Item -Force $denoJson $FunctionsDest
    Write-Ok "Copied: deno.json"
}

# --------------------------------------------------------------------------
# Restart functions service
# --------------------------------------------------------------------------
Write-Host ""
Write-Info "Restarting edge-runtime container..."
Set-Location $DockerDir

try {
    docker compose restart functions --no-deps
    Write-Host ""
    Write-Ok "Edge functions deployed and service restarted!"
} catch {
    Write-Host ""
    Write-Warn "Could not restart automatically. Run this manually on the Docker host:"
    Write-Host "  cd $DockerDir"
    Write-Host "  docker compose restart functions --no-deps"
}

Write-Host ""
Write-Host "Test a function:" -ForegroundColor Cyan
Write-Host '  curl http://localhost:8000/functions/v1/get-webhook-errors -H "Authorization: Bearer <SERVICE_ROLE_KEY>"'
Write-Host ""
Write-Host "View logs:" -ForegroundColor Cyan
Write-Host "  docker compose logs functions --tail=50"