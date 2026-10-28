<#
  Novaura Sovereign OS - update feed generator.

  Run after a signed build (PACKAGE_NOVAURA_OS.bat or `npm run tauri:build`).
  Produces, in release\:
    - novaura-sovereign-setup-<version>.exe   (the NSIS installer)
    - latest.json                              (the updater feed the app polls)

  Then serve both files from your own server (the relay VPS) at:
    https://relay.novaura.life/sovereign/latest.json
    https://relay.novaura.life/sovereign/novaura-sovereign-setup-<version>.exe

  No cloud provider is needed. Every installer is signed with the updater key
  and the app rejects anything the key did not sign, so any static HTTPS host or
  mirror works without being trusted.

  With -HostingDir, the files are also copied into that folder (for example a
  local copy of the web root you sync to the relay VPS).

  Remember to bump "version" in src-tauri\tauri.conf.json before each release;
  installed copies only update when the feed version is higher than theirs.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\publish-update.ps1 -Notes "Fixes mail delivery"
    powershell -ExecutionPolicy Bypass -File scripts\publish-update.ps1 -HostingDir "C:\relay-webroot\sovereign"
#>
param(
  [string]$Notes = '',
  [string]$BaseUrl = 'https://relay.novaura.life/sovereign',
  [string]$HostingDir = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$conf = Get-Content -Raw (Join-Path $ProjectRoot 'src-tauri\tauri.conf.json') | ConvertFrom-Json
$version = $conf.version
$product = $conf.productName

# The GNU build script builds into the shared cargo target dir and copies the bundle back here.
$candidates = @(
  (Join-Path $ProjectRoot 'src-tauri\target\release\bundle\nsis'),
  (Join-Path $env:USERPROFILE '.cargo\targets\novaura-sovereign\release\bundle\nsis')
)
$nsisDir = $candidates | Where-Object { Test-Path (Join-Path $_ "$($product)_$($version)_x64-setup.exe") } | Select-Object -First 1
if (-not $nsisDir) {
  throw "No installer for version $version found. Build first (PACKAGE_NOVAURA_OS.bat)."
}

$installer = Join-Path $nsisDir "$($product)_$($version)_x64-setup.exe"
$sigFile = "$installer.sig"
if (-not (Test-Path $sigFile)) {
  throw "Missing signature $sigFile. Build with the updater key present (see scripts\tauri-gnu.ps1)."
}

$releaseDir = Join-Path $ProjectRoot 'release'
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$publicName = "novaura-sovereign-setup-$version.exe"
Copy-Item $installer (Join-Path $releaseDir $publicName) -Force

$feed = [ordered]@{
  version   = $version
  notes     = $Notes
  pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  platforms = [ordered]@{
    'windows-x86_64' = [ordered]@{
      signature = (Get-Content -Raw $sigFile).Trim()
      url       = "$BaseUrl/$publicName"
    }
  }
}
$feedPath = Join-Path $releaseDir 'latest.json'
# Write UTF-8 WITHOUT a byte-order mark: the updater's JSON parser rejects a BOM.
$json = $feed | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($feedPath, $json, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Release $version prepared:" -ForegroundColor Green
Write-Host "  $feedPath"
Write-Host "  $(Join-Path $releaseDir $publicName)"

if ($HostingDir) {
  New-Item -ItemType Directory -Force -Path $HostingDir | Out-Null
  Copy-Item $feedPath (Join-Path $HostingDir 'latest.json') -Force
  Copy-Item (Join-Path $releaseDir $publicName) (Join-Path $HostingDir $publicName) -Force
  Write-Host "Copied to $HostingDir" -ForegroundColor Green
}
