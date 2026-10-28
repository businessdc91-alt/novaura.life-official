param(
    [switch]$ForceRebuild
)
$ErrorActionPreference = 'Stop'

$WebOsDist = "Z:\Novaura platform\NovAura-WebOS\dist\os"
$TauriDist = "Z:\Novaura platform\novaura OS soveriegn\dist"

if ($ForceRebuild -or -not (Test-Path (Join-Path $WebOsDist 'os.html'))) {
    Write-Host "[*] Building NovAura-WebOS production bundle..." -ForegroundColor Cyan
    Push-Location "Z:\Novaura platform\NovAura-WebOS"
    try {
        & npx vite build
    } finally {
        Pop-Location
    }
}

Write-Host "[*] Synchronizing live WebOS assets to Tauri frontendDist..." -ForegroundColor Cyan

# Ensure target directory exists and is clean
if (-not (Test-Path $TauriDist)) {
    New-Item -ItemType Directory -Path $TauriDist -Force | Out-Null
}

# Copy all built assets from NovAura-WebOS/dist/os
Copy-Item -Path "$WebOsDist\*" -Destination $TauriDist -Recurse -Force

# Read os.html and adapt for desktop root serving (create index.html)
$osHtml = Get-Content -Path "$TauriDist\os.html" -Raw -Encoding utf8
# Make asset paths relative so they load under tauri://localhost/ or asset://
$indexHtml = $osHtml -replace 'src="/os/assets/', 'src="./assets/' `
                     -replace 'href="/os/assets/', 'href="./assets/' `
                     -replace 'src="/assets/', 'src="./assets/' `
                     -replace 'href="/assets/', 'href="./assets/' `
                     -replace '<head>', "<head>`n    <script>window.__IS_DESKTOP_BUILD__ = true;</script>"

Set-Content -Path "$TauriDist\index.html" -Value $indexHtml -Encoding utf8

# Also create a nested 'os' folder inside dist to satisfy any hardcoded /os/ queries
$osSubdir = Join-Path $TauriDist 'os'
if (-not (Test-Path $osSubdir)) {
    New-Item -ItemType Directory -Path $osSubdir -Force | Out-Null
}
Copy-Item -Path "$TauriDist\assets" -Destination "$osSubdir\assets" -Recurse -Force
Copy-Item -Path "$TauriDist\index.html" -Destination "$osSubdir\os.html" -Force

Write-Host "[*] Live WebOS successfully synced into Tauri desktop dist!" -ForegroundColor Green
Write-Host "    Target: $TauriDist\index.html"
Write-Host "    Assets: $TauriDist\assets\"
