#!/usr/bin/env pwsh
# Combined build script for NovAura.life
# Builds Functions + WebOS + Landing + Platform into a single dist folder

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NovAura.life — Combined Build (Functions + WebOS + Platform)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Build Cloud Functions (Backend)
Write-Host "`n[1/4] Building Cloud Functions..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\functions"
npm run build
if ($LASTEXITCODE -ne 0) { throw "Functions build failed" }

# Step 2: Build all frontend apps (WebOS, Landing, Platform)
Write-Host "`n[2/4] Building WebOS + Landing + Platform..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

# Step 3: Merge platform dist and standardize OS entry point
Write-Host "`n[3/4] Standardizing directory structure..." -ForegroundColor Yellow

# Sync platform build (Vite outputs to platform/dist, hosting expects dist/platform)
if (Test-Path "$PSScriptRoot\dist\platform") {
    Remove-Item -Recurse -Force "$PSScriptRoot\dist\platform"
}
Copy-Item -Recurse "$PSScriptRoot\platform\dist" "$PSScriptRoot\dist\platform"
Write-Host "   Copied platform/dist → dist/platform" -ForegroundColor Gray

# Standardize OS entry point
if (Test-Path "$PSScriptRoot\dist\os\os.html") {
    Rename-Item "$PSScriptRoot\dist\os\os.html" "index.html" -Force
    Write-Host "   Renamed dist/os/os.html → dist/os/index.html" -ForegroundColor Gray
}

# Step 4: Deploy to Firebase
Write-Host "`n[4/4] Deploying to Firebase..." -ForegroundColor Yellow
Set-Location $PSScriptRoot

$deployFunctions = Read-Host "Deploy functions too? (y/n)"
if ($deployFunctions -eq 'y') {
    firebase deploy --only hosting,functions
} else {
    firebase deploy --only hosting
}

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  BUILD + DEPLOY COMPLETE!" -ForegroundColor Green
Write-Host "  Live: https://novaura.life" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
