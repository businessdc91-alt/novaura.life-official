#!/usr/bin/env pwsh
# Combined build script for NovAura.life
# Builds both WebOS and Platform into a single dist folder

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NovAura.life - Combined Build (WebOS + Platform)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Build Functions (Backend)
Write-Host "`n[1/5] Building Cloud Functions..." -ForegroundColor Yellow
cd "$PSScriptRoot\functions"
npm run build
if ($LASTEXITCODE -ne 0) { throw "Functions build failed" }

# Step 2: Build All Components (OS, Landing, Platform)
Write-Host "`n[2/4] Building All Components (OS, Landing, Platform)..." -ForegroundColor Yellow
cd $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# Step 3: Merge platform and standardize OS entry point
Write-Host "`n[3/4] Standardizing Directory Structure..." -ForegroundColor Yellow

# Move platform
if (Test-Path "$PSScriptRoot\dist\platform") {
    Remove-Item -Recurse -Force "$PSScriptRoot\dist\platform"
}
Copy-Item -Recurse "$PSScriptRoot\platform\dist" "$PSScriptRoot\dist\platform"

# Standardize OS entry point (rename os.html to index.html for standard hosting)
if (Test-Path "$PSScriptRoot\dist\os\os.html") {
    Write-Host "   Renaming dist/os/os.html to dist/os/index.html..." -ForegroundColor Gray
    Rename-Item "$PSScriptRoot\dist\os\os.html" "index.html" -Force
}

# Step 4: Create _redirects for combined routing
Write-Host "`n[4/4] Setting up routing rules..." -ForegroundColor Yellow
$redirects = @"
# NovAura.life - Combined App Routing
# Platform routes (Marketplace, Auth, etc.)
/platform/*  /platform/index.html  200
/login       /platform/index.html  200
/browse      /platform/index.html  200
/domains     /platform/index.html  200
/market      /platform/index.html  200

# WebOS routes (ensure wildcard support for deep links)
/system/*    /os/index.html        200
/os/*        /os/index.html        200
/system      /os/index.html        200
/os          /os/index.html        200

# Catch-all (Landing page - ROOT)
/*           /index.html           200
"@

$redirects | Out-File -FilePath "$PSScriptRoot\dist\_redirects" -Encoding utf8

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
Write-Host "  Output: dist/" -ForegroundColor Green
Write-Host "  Deploy: firebase deploy --only hosting:novaura-life" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
