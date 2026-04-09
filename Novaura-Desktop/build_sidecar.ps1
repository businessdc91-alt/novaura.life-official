# Aura Nova Sidecar — PyInstaller Build Script
# Usage:
#   Set $env:AURA_ENCRYPTION_KEY to a 32-char string before running
#   .\build_sidecar.ps1                   → builds encrypted CONSUMER sidecar
#   .\build_sidecar.ps1 -Tier FULL        → builds unencrypted FULL sidecar (dev only)
#   .\build_sidecar.ps1 -Clean            → wipe dist/build dirs before building

param(
    [string]$Tier = "CONSUMER",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

# ── Paths ──────────────────────────────────────────────────────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$SidecarDir  = Join-Path $ScriptDir "aura_sidecar"
$NovaFiles   = Join-Path $ScriptDir "aura_NovaFiles"
$DistDir     = Join-Path $SidecarDir "dist"
$BuildDir    = Join-Path $SidecarDir "build"
$TargetDir   = Join-Path $ScriptDir "src-tauri\sidecar"

# ── Encryption key ─────────────────────────────────────────────────────────────
# In production: key is baked into the binary — not in .env, not in any file
# The sidecar never reads this key; PyInstaller bakes it at compile time
$EncryptionKey = $env:AURA_ENCRYPTION_KEY
if (-not $EncryptionKey -and $Tier -eq "CONSUMER") {
    Write-Warning "AURA_ENCRYPTION_KEY not set — generating ephemeral key for this build."
    Write-Warning "Set AURA_ENCRYPTION_KEY in your environment to get a stable encrypted build."
    # Generate 32-char alphanumeric key
    $EncryptionKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AURA NOVA SIDECAR BUILD" -ForegroundColor Cyan
Write-Host "  Tier: $Tier" -ForegroundColor Yellow
Write-Host "  Target: $TargetDir" -ForegroundColor White
Write-Host "  Encryption: $( if ($EncryptionKey) { 'YES (bytecode encrypted)' } else { 'NO (dev build)' } )" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Clean ──────────────────────────────────────────────────────────────────────
if ($Clean) {
    Write-Host "[BUILD] Cleaning dist/build..." -ForegroundColor DarkGray
    if (Test-Path $DistDir)  { Remove-Item $DistDir  -Recurse -Force }
    if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
}

# ── Ensure target dir exists ───────────────────────────────────────────────────
if (-not (Test-Path $TargetDir)) { New-Item -ItemType Directory -Path $TargetDir | Out-Null }

# ── Check PyInstaller is available ────────────────────────────────────────────
try {
    pyinstaller --version | Out-Null
} catch {
    Write-Host "[BUILD] PyInstaller not found — installing..." -ForegroundColor Yellow
    pip install pyinstaller
}

# ── Build arguments ────────────────────────────────────────────────────────────
$Args = @(
    "--onefile",
    "--noconfirm",
    "--name=aura_sidecar",
    "--distpath=$TargetDir",
    "--workpath=$BuildDir",
    "--specpath=$SidecarDir",
    # Embed the nova mesh files
    "--add-data=$NovaFiles;aura_NovaFiles",
    # Add personality and model weights
    "--add-data=$NovaFiles\learned_personality.json;.",
    # Set tier at build time via env (still reads at runtime for safety)
    "--env-file=", # blank — env is set at spawn time by Rust
    # Needed imports that PyInstaller misses in dynamic imports
    "--hidden-import=importlib.util",
    "--hidden-import=transformers",
    "--hidden-import=sentence_transformers",
    "--hidden-import=httpx",
    "--hidden-import=asyncio",
    # Suppress console window on Windows release builds
    "--noconsole"
)

# Add model.pt if it exists
$ModelPath = Join-Path $NovaFiles "model.pt"
if (Test-Path $ModelPath) {
    $Args += "--add-data=$ModelPath;."
}

# Add encryption key (bakes AES key into bytecode encryption)
if ($EncryptionKey) {
    $Args += "--key=$EncryptionKey"
    Write-Host "[BUILD] Bytecode encryption: ENABLED" -ForegroundColor Green
} else {
    Write-Host "[BUILD] Bytecode encryption: DISABLED (dev build)" -ForegroundColor Yellow
}

# Entry point
$Args += Join-Path $SidecarDir "sidecar.py"

# ── Run PyInstaller ────────────────────────────────────────────────────────────
Write-Host "[BUILD] Running PyInstaller..." -ForegroundColor Cyan
Push-Location $SidecarDir
try {
    & pyinstaller @Args
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}

# ── Verify output ──────────────────────────────────────────────────────────────
$OutBin = Join-Path $TargetDir "aura_sidecar.exe"
if (-not (Test-Path $OutBin)) { $OutBin = Join-Path $TargetDir "aura_sidecar" }

if (Test-Path $OutBin) {
    $SizeMB = [math]::Round((Get-Item $OutBin).Length / 1MB, 1)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  BUILD COMPLETE" -ForegroundColor Green
    Write-Host "  Output: $OutBin" -ForegroundColor White
    Write-Host "  Size: ${SizeMB} MB" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Error "[BUILD] Output binary not found — build may have failed"
}
