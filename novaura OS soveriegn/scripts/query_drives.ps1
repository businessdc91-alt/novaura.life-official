$v = Get-Volume | Where-Object { $_.DriveLetter -ne $null } | Select-Object DriveLetter, FileSystemLabel, FileSystem, DriveType, SizeRemaining, Size
$p = Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, OperationalStatus, HealthStatus, Size
$part = Get-Partition | Where-Object { $_.DriveLetter -ne $null } | Select-Object DiskNumber, PartitionNumber, DriveLetter, IsBoot, IsSystem

[PSCustomObject]@{
    Volumes = $v
    PhysicalDisks = $p
    Partitions = $part
} | ConvertTo-Json -Depth 4
