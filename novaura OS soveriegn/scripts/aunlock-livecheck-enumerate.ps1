<#
  Aunlock Phase 1b-A — read-only device enumeration cross-check.

  Prints the SAME JSON the Rust command `aunlock_enumerate_devices` reads, using the SAME query
  (AUNLOCK_CIM_QUERY in src-tauri/src/aunlock_devices_rules.rs). Use it during the gated live check
  (src-tauri/aunlock/livecheck-enumerate.md) to confirm the app's device list matches the raw read.

  Strictly read-only: it only runs Get-* cmdlets. It never writes to, mounts, repartitions, or
  unlocks any device. Keep this file in sync with AUNLOCK_CIM_QUERY if that query changes.
#>
$ErrorActionPreference = 'SilentlyContinue'
$enc = @{}
foreach ($v in (Get-BitLockerVolume)) {
  if ($v.MountPoint) {
    $p = Get-Partition -DriveLetter ($v.MountPoint.TrimEnd(':'))
    if ($p) { $enc[[int]$p.DiskNumber] = ($v.ProtectionStatus -eq 'On') }
  }
}
$out = foreach ($d in (Get-Disk)) {
  [pscustomobject]@{
    Kind           = 'drive'
    Model          = $d.FriendlyName
    SerialNumber   = ("$($d.SerialNumber)").Trim()
    Size           = $d.Size
    BusType        = [string]$d.BusType
    MediaType      = [string]$d.MediaType
    RemovableMedia = ([string]$d.BusType -eq 'USB')
    IsBoot         = [bool]$d.IsBoot
    IsSystem       = [bool]$d.IsSystem
    Encrypted      = $(if ($enc.ContainsKey([int]$d.Number)) { $enc[[int]$d.Number] } else { $null })
  }
}
@($out) | ConvertTo-Json -Depth 4
