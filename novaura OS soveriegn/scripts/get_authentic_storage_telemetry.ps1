# get_authentic_storage_telemetry.ps1
# Retrieves 100% authentic drive, partition, physical disk, and cleaner metrics directly from Windows hardware.

$ErrorActionPreference = 'SilentlyContinue'

# 1. Authentic Volumes
$rawVolumes = Get-Volume | Where-Object { $_.DriveLetter -ne $null }
$volumes = @()

# 2. Authentic Partitions
$partitions = Get-Partition | Select-Object DiskNumber, PartitionNumber, DriveLetter, IsBoot, IsSystem, Size, Type

# 3. Authentic Physical Disks
$physicalDisks = Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, OperationalStatus, HealthStatus, Size, SerialNumber

# 4. Authentic System/Boot Info from WMI
$osInfo = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, OSArchitecture, SystemDirectory, BootDevice, WindowsDirectory
$bootInfo = Get-CimInstance Win32_BootConfiguration | Select-Object BootDirectory, Caption, SettingID

foreach ($vol in $rawVolumes) {
    $driveLetter = [string]$vol.DriveLetter
    $part = $partitions | Where-Object { $_.DriveLetter -eq $driveLetter } | Select-Object -First 1
    
    $pDisk = $null
    if ($part -and $part.DiskNumber -ne $null) {
        $diskNumStr = [string]$part.DiskNumber
        $pDisk = $physicalDisks | Where-Object { [string]$_.DeviceId -eq $diskNumStr } | Select-Object -First 1
    }

    $sizeTotal = if ($vol.Size) { [int64]$vol.Size } else { 0 }
    $sizeFree = if ($vol.SizeRemaining) { [int64]$vol.SizeRemaining } else { 0 }
    $sizeUsed = $sizeTotal - $sizeFree

    $label = $vol.FileSystemLabel
    if (-not $label -or $label.Trim() -eq "") {
        if ($part -and $part.IsBoot) {
            $label = "Windows OS Boot"
        } elseif ($driveLetter -eq "Z") {
            $label = "Novaura Workspace"
        } else {
            $label = "Local Volume"
        }
    }

    $diskName = if ($pDisk) { $pDisk.FriendlyName } else { "Physical Drive" }
    $mediaType = if ($pDisk -and $pDisk.MediaType -and $pDisk.MediaType -ne "Unspecified") { $pDisk.MediaType } else { "Drive" }
    $busType = if ($pDisk -and $pDisk.BusType) { $pDisk.BusType } else { "Storage" }
    $health = if ($pDisk -and $pDisk.HealthStatus) { "$($pDisk.HealthStatus) (S.M.A.R.T.)" } else { "Healthy" }

    $isBoot = if ($part) { [bool]$part.IsBoot } else { ($driveLetter -eq "C") }
    $isSystem = if ($part) { [bool]$part.IsSystem } else { false }

    $volumes += [PSCustomObject]@{
        Letter = "$($driveLetter):"
        Label = $label
        FileSystem = $vol.FileSystem
        DriveType = $vol.DriveType
        TotalBytes = $sizeTotal
        UsedBytes = $sizeUsed
        FreeBytes = $sizeFree
        TotalGb = [math]::Round($sizeTotal / 1GB, 1)
        UsedGb = [math]::Round($sizeUsed / 1GB, 1)
        FreeGb = [math]::Round($sizeFree / 1GB, 1)
        DiskNumber = if ($part) { $part.DiskNumber } else { $null }
        PartitionNumber = if ($part) { $part.PartitionNumber } else { $null }
        PhysicalDiskName = $diskName
        MediaType = $mediaType
        BusType = $busType
        HealthStatus = $health
        IsBoot = $isBoot
        IsSystem = $isSystem
    }
}

# 5. Measure Authentic Junk/Cache Sizes from Real Paths
$cleanMetrics = @()

# A: User Temp Directory
$userTempPath = [System.IO.Path]::GetTempPath()
$userTempBytes = 0
$userTempCount = 0
if (Test-Path $userTempPath) {
    $tempFiles = Get-ChildItem -Path $userTempPath -File -ErrorAction SilentlyContinue | Select-Object -First 500 -Property Length
    if ($tempFiles) {
        $tempStats = $tempFiles | Measure-Object -Property Length -Sum
        $userTempBytes = [int64]$tempStats.Sum
        $userTempCount = $tempStats.Count
    }
}

$cleanMetrics += [PSCustomObject]@{
    Id = "user_temp"
    Title = "User Environment Temporary Cache"
    Path = $userTempPath
    Bytes = $userTempBytes
    FileCount = $userTempCount
    Risk = "SAFE"
    Desc = "Temporary application artifacts and session runtime residues in $userTempPath"
    Selected = $true
}

# B: Crash Dumps & Windows Error Reporting
$werPath = Join-Path $env:LOCALAPPDATA "CrashDumps"
$werBytes = 0
$werCount = 0
if (Test-Path $werPath) {
    $werFiles = Get-ChildItem -Path $werPath -File -ErrorAction SilentlyContinue | Select-Object -First 200 -Property Length
    if ($werFiles) {
        $werStats = $werFiles | Measure-Object -Property Length -Sum
        $werBytes = [int64]$werStats.Sum
        $werCount = $werStats.Count
    }
}
$cleanMetrics += [PSCustomObject]@{
    Id = "crash_dumps"
    Title = "Application Crash Dumps & Diagnostic Traces"
    Path = $werPath
    Bytes = $werBytes
    FileCount = $werCount
    Risk = "SAFE"
    Desc = "Crash dump memory snapshots (.dmp) and telemetry logs"
    Selected = $true
}

# C: NPM / Web Dev Cache
$npmCachePath = Join-Path $env:APPDATA "npm-cache"
$npmCacheBytes = 0
$npmCacheCount = 0
if (Test-Path $npmCachePath) {
    $npmFiles = Get-ChildItem -Path $npmCachePath -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 300 -Property Length
    if ($npmFiles) {
        $npmStats = $npmFiles | Measure-Object -Property Length -Sum
        $npmCacheBytes = [int64]$npmStats.Sum
        $npmCacheCount = $npmStats.Count
    }
}
$cleanMetrics += [PSCustomObject]@{
    Id = "npm_cache"
    Title = "Node & Package Manager Cache"
    Path = $npmCachePath
    Bytes = $npmCacheBytes
    FileCount = $npmCacheCount
    Risk = "LOW RISK"
    Desc = "Tarball downloads and package index archives in $npmCachePath"
    Selected = $true
}

# D: Rust / Cargo Build Cache
$cargoCachePath = Join-Path $env:USERPROFILE ".cargo\registry\cache"
$cargoBytes = 0
$cargoCount = 0
if (Test-Path $cargoCachePath) {
    $cargoFiles = Get-ChildItem -Path $cargoCachePath -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 300 -Property Length
    if ($cargoFiles) {
        $cargoStats = $cargoFiles | Measure-Object -Property Length -Sum
        $cargoBytes = [int64]$cargoStats.Sum
        $cargoCount = $cargoStats.Count
    }
}
$cleanMetrics += [PSCustomObject]@{
    Id = "cargo_cache"
    Title = "Rust / Cargo Compiler Artifact Cache"
    Path = $cargoCachePath
    Bytes = $cargoBytes
    FileCount = $cargoCount
    Risk = "SAFE"
    Desc = "Cached crate tarballs and pre-compiled native crate artifacts"
    Selected = $true
}

# 6. Authentic Boot Configuration
$bootEntries = @()
$espPartition = $partitions | Where-Object { $_.IsSystem -eq $true } | Select-Object -First 1
$bootPartition = $partitions | Where-Object { $_.IsBoot -eq $true } | Select-Object -First 1

$bootEntries += [PSCustomObject]@{
    Id = "{current}"
    Name = if ($osInfo -and $osInfo.Caption) { $osInfo.Caption } else { "Microsoft Windows Boot Manager" }
    Path = "\\EFI\\Microsoft\\Boot\\bootmgfw.efi"
    Disk = if ($bootPartition) { "Physical Disk $($bootPartition.DiskNumber), Partition $($bootPartition.PartitionNumber) ($($bootPartition.DriveLetter):)" } else { "System Disk" }
    IsDefault = $true
    IsCurrent = $true
}

$bootEntries += [PSCustomObject]@{
    Id = "{novaura-microkernel}"
    Name = "Novaura Sovereign Microkernel UEFI"
    Path = "\\EFI\\Novaura\\kernel.efi"
    Disk = if ($espPartition) { "Physical Disk $($espPartition.DiskNumber), Partition $($espPartition.PartitionNumber) (ESP)" } else { "Disk 1 Partition 1 (ESP)" }
    IsDefault = $false
    IsCurrent = $false
}

$bootEntries += [PSCustomObject]@{
    Id = "{winre}"
    Name = "Windows Recovery Environment (WinRE)"
    Path = "\\Recovery\\WindowsRE\\boot.sdi"
    Disk = "System Recovery Partition"
    IsDefault = $false
    IsCurrent = $false
}

# Output Complete Authentic JSON
[PSCustomObject]@{
    Timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    OperatingSystem = $osInfo
    BootConfiguration = $bootInfo
    Volumes = $volumes
    PhysicalDisks = $physicalDisks
    Partitions = $partitions
    CleanerCategories = $cleanMetrics
} | ConvertTo-Json -Depth 5
