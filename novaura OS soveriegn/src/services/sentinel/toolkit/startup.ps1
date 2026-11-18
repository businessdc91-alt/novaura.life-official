# startup.ps1 — runs at Windows Sandbox logon for a Sentinel Probe run.
#
# The sandbox already has NO network adapter (the .wsb sets <Networking>Disable</Networking>).
# As defence in depth this also sets the firewall to block all traffic by default with no
# allow rules. The only thing the run talks to is the loopback server started below, which
# serves a COPY of the target placed in C:\sentinel\in\site. Nothing here can reach the
# host or the internet. This script is static and is exercised by the Task 9 live check.

$ErrorActionPreference = 'Continue'

# Belt-and-braces no egress.
try {
  Set-NetFirewallProfile -All -DefaultOutboundAction Block -DefaultInboundAction Block -AllowInboundRules False -AllowLocalFirewallRules False
} catch {}

$in   = 'C:\sentinel\in'
$site = Join-Path $in 'site'   # the copied, servable target content
$port = 8080

# Serve the copied content on loopback only, in the background.
Start-Job -Name sentinelServer -ArgumentList $site, $port -ScriptBlock {
  param($site, $port)
  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add("http://127.0.0.1:$port/")
  $listener.Start()
  while ($listener.IsListening) {
    try {
      $ctx = $listener.GetContext()
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $path = Join-Path $site $rel
      # Never serve outside the copied site folder.
      $full = [System.IO.Path]::GetFullPath($path)
      if ($full.StartsWith([System.IO.Path]::GetFullPath($site)) -and (Test-Path $full -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ctx.Response.StatusCode = 200
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
      }
      $ctx.Response.Close()
    } catch {}
  }
}

# Run the executor in the foreground; it answers commands over the mapped io folder.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $in 'executor.ps1')
