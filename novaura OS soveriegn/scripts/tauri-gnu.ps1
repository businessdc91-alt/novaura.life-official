<#
  Novaura Sovereign OS - Tauri runner for the GNU (MinGW) Rust toolchain.

  Why this exists:
    - This machine has no MSVC Build Tools, so the default msvc toolchain cannot link.
    - GNU windres breaks on paths containing spaces ("Novaura platform", "novaura OS soveriegn"),
      so the project is mapped to a space-free virtual drive (N:) via `subst`.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts/tauri-gnu.ps1 -Mode check
    powershell -ExecutionPolicy Bypass -File scripts/tauri-gnu.ps1 -Mode dev
    powershell -ExecutionPolicy Bypass -File scripts/tauri-gnu.ps1 -Mode build [-Bundles nsis|msi|none] [-DebugBuild] [-KeepVersion]

  Every build raises the patch version in src-tauri\tauri.conf.json by one (1.0.1, 1.0.2, ...),
  and only the newest installer is kept, so an old installer can't be run by mistake.
#>
param(
  [ValidateSet('check', 'dev', 'build')]
  [string]$Mode = 'build',
  [string]$Bundles = 'nsis',
  [switch]$DebugBuild,
  [string]$DriveLetter = 'N:',
  # Close a running Sovereign instance if its app.exe is locked during copy-back.
  [switch]$KillRunning,
  # Rebuild under the current version number instead of raising it.
  [switch]$KeepVersion
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$MingwBin = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin'
$Toolchain = 'stable-x86_64-pc-windows-gnu'

# ---- Preflight -------------------------------------------------------------
if (-not (Test-Path (Join-Path $MingwBin 'gcc.exe'))) {
  throw "WinLibs MinGW not found at '$MingwBin'. Install with: winget install BrechtSanders.WinLibs.POSIX.UCRT"
}
$installed = (& rustup toolchain list) -join "`n"
if ($installed -notmatch [regex]::Escape($Toolchain)) {
  throw "Rust toolchain '$Toolchain' missing. Install with: rustup toolchain install $Toolchain"
}

# ---- Virtual drive mapping (idempotent) ------------------------------------
$existing = (& subst) | Where-Object { $_ -like "$DriveLetter\:*" }
if ($existing) {
  $mappedTo = ($existing -split '=>\s*', 2)[1].Trim().TrimEnd('\')
  if ($mappedTo -ne $ProjectRoot) {
    throw "$DriveLetter is already mapped to '$mappedTo' (expected '$ProjectRoot'). Run 'subst $DriveLetter /D' or pass -DriveLetter."
  }
} else {
  & subst $DriveLetter $ProjectRoot
  if ($LASTEXITCODE -ne 0) { throw "subst $DriveLetter failed (exit $LASTEXITCODE)" }
}

# ---- Environment -----------------------------------------------------------
$env:PATH = "$MingwBin;$env:PATH"
$env:RUSTUP_TOOLCHAIN = $Toolchain
$LocalTargetDir = Join-Path $env:USERPROFILE ".cargo\targets\novaura-sovereign"
if (-not (Test-Path $LocalTargetDir)) {
  New-Item -ItemType Directory -Path $LocalTargetDir -Force | Out-Null
}
$env:CARGO_TARGET_DIR = $LocalTargetDir

# ---- Updater signing (key lives outside the repo) --------------------------
# Generated with: npx tauri signer generate -w $HOME\.tauri\novaura-sovereign.key
# Back these files up. Losing the key means installed copies can no longer update.
$SigningKey = Join-Path $env:USERPROFILE '.tauri\novaura-sovereign.key'
$SigningPw  = Join-Path $env:USERPROFILE '.tauri\novaura-sovereign.key.password'
if ($Mode -eq 'build') {
  if ((Test-Path $SigningKey) -and -not $env:TAURI_SIGNING_PRIVATE_KEY) {
    $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw $SigningKey).Trim()
    if (Test-Path $SigningPw) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content -Raw $SigningPw).Trim() }
  }
  if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Warning "No updater signing key found at $SigningKey. Update artifacts (.sig) will not be produced."
  }
}

# ---- Version: one number per build -------------------------------------------
# The app shows it in the top bar (src/config/buildInfo.js) and the installer carries it in its name.
$ConfPath = Join-Path $ProjectRoot 'src-tauri\tauri.conf.json'
$confText = [IO.File]::ReadAllText($ConfPath)
$versionMatch = [regex]::Match($confText, '"version":\s*"(\d+)\.(\d+)\.(\d+)"')
if (-not $versionMatch.Success) { throw "No x.y.z version found in $ConfPath" }
$Version = '{0}.{1}.{2}' -f $versionMatch.Groups[1].Value, $versionMatch.Groups[2].Value, $versionMatch.Groups[3].Value
if ($Mode -eq 'build' -and -not $KeepVersion) {
  $Version = '{0}.{1}.{2}' -f $versionMatch.Groups[1].Value, $versionMatch.Groups[2].Value, ([int]$versionMatch.Groups[3].Value + 1)
  $confText = $confText.Substring(0, $versionMatch.Index) + "`"version`": `"$Version`"" + $confText.Substring($versionMatch.Index + $versionMatch.Length)
  [IO.File]::WriteAllText($ConfPath, $confText, (New-Object System.Text.UTF8Encoding $false))
}
if ($Mode -eq 'build') { Write-Host "Building Novaura Sovereign OS $Version" -ForegroundColor Cyan }

# Installers from earlier builds, which would otherwise pile up beside the new one.
function Remove-OlderInstallers([string]$NsisDir) {
  Get-ChildItem $NsisDir -Filter '*_x64-setup.exe*' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*_$($Version)_x64-setup.exe*" } |
    Remove-Item -Force
}

Push-Location "$DriveLetter\"
try {
  switch ($Mode) {
    'check' {
      & cargo check --manifest-path "$DriveLetter\src-tauri\Cargo.toml"
    }
    'dev' {
      & npx tauri dev
    }
    'build' {
      $tauriArgs = @('tauri', 'build')
      if ($DebugBuild) { $tauriArgs += '--debug' }
      if ($Bundles -eq 'none') { $tauriArgs += '--no-bundle' } else { $tauriArgs += @('--bundles', $Bundles) }
      & npx @tauriArgs
    }
  }
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

if ($code -ne 0) { throw "tauri $Mode failed with exit code $code" }

$buildProfile = if ($DebugBuild) { 'debug' } else { 'release' }
if ($Mode -eq 'build') {
  $destRelease = Join-Path $ProjectRoot "src-tauri\target\$buildProfile"
  if (-not (Test-Path $destRelease)) {
    New-Item -ItemType Directory -Path $destRelease -Force | Out-Null
  }
  if (Test-Path (Join-Path $LocalTargetDir "$buildProfile\app.exe")) {
    $targetExe = Join-Path $destRelease "app.exe"
    try {
      Copy-Item -Path (Join-Path $LocalTargetDir "$buildProfile\app.exe") -Destination $targetExe -Force
    } catch {
      if ($KillRunning) {
        Write-Host "app.exe is locked by a running instance; closing it and retrying..." -ForegroundColor Yellow
        Get-Process -Name 'app' -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Milliseconds 600
        Copy-Item -Path (Join-Path $LocalTargetDir "$buildProfile\app.exe") -Destination $targetExe -Force
      } else {
        Write-Warning "app.exe is in use (Sovereign is running), so the local copy was not replaced. Close the app and rebuild, or pass -KillRunning. The installer is still up to date."
      }
    }
  }
  if (Test-Path (Join-Path $LocalTargetDir "$buildProfile\bundle")) {
    Remove-OlderInstallers (Join-Path $LocalTargetDir "$buildProfile\bundle\nsis")
    Copy-Item -Path (Join-Path $LocalTargetDir "$buildProfile\bundle") -Destination $destRelease -Recurse -Force
    Remove-OlderInstallers (Join-Path $destRelease 'bundle\nsis')
  }

  Write-Host ""
  Write-Host "Build artifacts:" -ForegroundColor Green
  Get-ChildItem $destRelease -Filter *.exe -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.FullName)" }
  Get-ChildItem (Join-Path $destRelease "bundle") -Recurse -Include *.exe, *.msi -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.FullName)" }
}
