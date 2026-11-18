# executor.ps1 — the in-sandbox command executor for a Sentinel Probe run.
#
# Polls C:\sentinel\io for cmd-<n>.json written by the host, runs the ONE command the
# safety foundation supports, and writes obs-<n>.json back for the host to read. The only
# command is "echo": fetch the loopback root and report the HTTP status and the response
# header NAMES (never bodies). Everything stays on 127.0.0.1 — there is no other network.
# Static; exercised by the Task 9 live check.

$ErrorActionPreference = 'Continue'

$io   = 'C:\sentinel\io'
$base = 'http://127.0.0.1:8080/'
$seen = @{}

while ($true) {
  Get-ChildItem -Path $io -Filter 'cmd-*.json' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $name = $_.Name
    if ($seen.ContainsKey($name)) { return }
    if ($name -notmatch '^cmd-(\d+)\.json$') { return }
    $seen[$name] = $true
    $n   = $Matches[1]
    $obs = Join-Path $io ("obs-$n.json")
    $result = [ordered]@{ status = 0; headers = @(); servedPaths = @() }
    try {
      $cmd = Get-Content $_.FullName -Raw | ConvertFrom-Json
      if ($cmd.op -eq 'echo') {
        $resp = Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 10
        $result.status = [int]$resp.StatusCode
        $result.headers = @($resp.Headers.Keys)          # header NAMES only
        $result.servedPaths = @('index.html')
      } else {
        $result.status = -1
        $result.error = 'unsupported command'
      }
    } catch {
      $result.status = -1
      $result.error = 'request failed'
    }
    ($result | ConvertTo-Json -Depth 5) | Set-Content -Path $obs -Encoding UTF8
  }
  Start-Sleep -Milliseconds 300
}
