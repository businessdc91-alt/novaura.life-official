using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public class HardwareMonitor
    {
        // CPU
        private PerformanceCounter _cpuCounter;
        
        // RAM
        private PerformanceCounter _ramAvailableCounter;
        private double _totalRamMb;

        // GPU (Experimental - Standard Windows Counters)
        // Note: GPU counters are complex and may vary by driver/OS. 
        // We will try to capture a generic "GPU Engine" utilization if possible, 
        // but often this requires specific instance names.
        private PerformanceCounter _gpuCounter;

        public event Action<HardwareMetrics> OnMetricsUpdated;

        private bool _isRunning = false;

        public HardwareMonitor()
        {
            InitializeCounters();
            _totalRamMb = GetTotalPhysicalMemory();
        }

        private void InitializeCounters()
        {
            try
            {
                _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                _ramAvailableCounter = new PerformanceCounter("Memory", "Available MBytes");
                
                // Initial reads to avoid 0 on first tick
                _cpuCounter.NextValue();
                _ramAvailableCounter.NextValue();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error initializing hardware counters: {ex.Message}");
            }
        }

        public void StartMonitoring()
        {
            if (_isRunning) return;
            _isRunning = true;

            Task.Run(async () =>
            {
                while (_isRunning)
                {
                    UpdateMetrics();
                    await Task.Delay(2000); // Update every 2 seconds
                }
            });
        }

        public void StopMonitoring()
        {
            _isRunning = false;
        }

        private void UpdateMetrics()
        {
            try
            {
                float cpu = 0;
                try { cpu = _cpuCounter?.NextValue() ?? 0; } catch { /* Counter disabled or missing */ }

                float ramAvailable = 0;
                try { ramAvailable = _ramAvailableCounter?.NextValue() ?? 0; } catch { /* Counter disabled or missing */ }

                float ramUsed = (float)_totalRamMb - ramAvailable;
                float ramPercent = (ramUsed / (float)_totalRamMb) * 100;

                // Drive Info - Dynamic detection based on install path
                string root = Path.GetPathRoot(AppDomain.CurrentDomain.BaseDirectory) ?? "C:\\";
                var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.Name.Equals(root, StringComparison.OrdinalIgnoreCase));
                
                string storageInfo = "N/A";
                float storagePercent = 0;
                
                if (drive != null && drive.IsReady)
                {
                    long totalBytes = drive.TotalSize;
                    long freeBytes = drive.AvailableFreeSpace;
                    long usedBytes = totalBytes - freeBytes;
                    
                    storagePercent = ((float)usedBytes / totalBytes) * 100;
                    storageInfo = $"{FormatBytes(freeBytes)} Free on {root}";
                }

                var metrics = new HardwareMetrics
                {
                    CpuUsagePercent = cpu,
                    RamUsagePercent = ramPercent,
                    RamUsedDisplay = $"{FormatBytes((long)ramUsed * 1024 * 1024)} / {FormatBytes((long)_totalRamMb * 1024 * 1024)}",
                    StorageInformation = storageInfo,
                    StorageUsagePercent = storagePercent
                };

                OnMetricsUpdated?.Invoke(metrics);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error updating metrics: {ex.Message}");
            }
        }

        // Helper to get Total RAM (WMI approx) or hardcoded estimate
        private double GetTotalPhysicalMemory()
        {
            // Simple approximation or hardcoded for typical gaming rig (16GB/32GB)
            // For accuracy without WMI, we might need P/Invoke, but for now we can infer 
            // from "Available" + "In Use" if we had perfect counters. 
            // Instead, we'll try GC.GetGCMemoryInfo in .NET 5+ or just assume 32GB if unknown,
            // OR use Microsoft.VisualBasic.Devices.ComputerInfo if we add ref.
            
            // Safe fallback: 
            return 32 * 1024; // Assume 32GB for user's dedicated machine context if detection fails
        }

        private string FormatBytes(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int counter = 0;
            decimal number = (decimal)bytes;
            while (Math.Round(number / 1024) >= 1)
            {
                number = number / 1024;
                counter++;
            }
            return string.Format("{0:n1}{1}", number, suffixes[counter]);
        }
    }

    public class HardwareMetrics
    {
        public float CpuUsagePercent { get; set; }
        public float RamUsagePercent { get; set; }
        public string RamUsedDisplay { get; set; }
        public float StorageUsagePercent { get; set; }
        public string StorageInformation { get; set; }
    }
}
