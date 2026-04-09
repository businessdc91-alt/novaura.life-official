/*
 * AURA SMART FILE SHARING - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Intelligent file sharing that adapts to user's connection speed
 *
 * TWO METHODS AVAILABLE:
 *
 * 1. P2P REMOTE ACCESS (Fast Connections)
 *    - Files stay on your PC
 *    - Real-time streaming to collaborators
 *    - No upload needed
 *    - Requires: Both users online, good connection (>5 Mbps)
 *    - Best for: Large files, real-time collaboration, fast internet
 *
 * 2. CLOUD UPLOAD (Slow Connections or Async)
 *    - Upload to cloud once
 *    - Others download when convenient
 *    - Works offline (queued upload)
 *    - Requires: Just your upload (any speed)
 *    - Best for: Slow internet, async work, guaranteed delivery
 *
 * SMART DETECTION:
 * - Automatically detects connection speed
 * - Recommends best method
 * - User always has final choice
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum SharingMethod
    {
        P2P_RemoteAccess,    // Real-time streaming, files stay local
        CloudUpload,         // Traditional upload to cloud
        Automatic            // Let system decide based on connection
    }

    public enum ConnectionQuality
    {
        Excellent,   // >50 Mbps - Recommend P2P
        Good,        // 10-50 Mbps - Either works
        Fair,        // 5-10 Mbps - P2P possible but slow
        Poor,        // 1-5 Mbps - Recommend cloud upload
        VeryPoor     // <1 Mbps - Cloud upload only
    }

    public class SharingRecommendation
    {
        public SharingMethod RecommendedMethod { get; set; }
        public string Reason { get; set; }
        public ConnectionQuality ConnectionQuality { get; set; }
        public double UploadSpeedMbps { get; set; }
        public double DownloadSpeedMbps { get; set; }
        public long FileSizeBytes { get; set; }
        public TimeSpan EstimatedP2PTime { get; set; }
        public TimeSpan EstimatedUploadTime { get; set; }
        public bool BothUsersOnline { get; set; }
    }

    /// <summary>
    /// Result of ShareFileSmartAsync - used by AuraToolRegistry
    /// </summary>
    public class FileShareResult
    {
        public SharingMethod MethodUsed { get; set; }
        public string ShareLink { get; set; } = "";
        public bool Success { get; set; }
        public string? Error { get; set; }
    }

    public class FileShareOptions
    {
        public string FilePath { get; set; }
        public SharingMethod Method { get; set; } = SharingMethod.Automatic;
        public List<string> ShareWithUserIds { get; set; } = new();
        public RemoteAccessMode AccessMode { get; set; } = RemoteAccessMode.ReadOnly;
        public TimeSpan ExpiresIn { get; set; } = TimeSpan.FromDays(7);
        public bool CompressBeforeUpload { get; set; } = true;
        public int UploadChunkSizeMB { get; set; } = 10;
        
        // Alias for Method - used by AuraToolRegistry
        public SharingMethod PreferredMethod
        {
            get => Method;
            set => Method = value;
        }
    }

    public class AuraSmartFileSharing
    {
        private readonly AuraRemoteFileAccess _remoteAccess;
        private readonly AuraCollaborationHub _collaboration;
        private readonly AuraAuthenticationHub _auth;

        // Connection monitoring
        private double _uploadSpeedMbps = 0;
        private double _downloadSpeedMbps = 0;
        private DateTime _lastSpeedTest = DateTime.MinValue;

        public AuraSmartFileSharing(
            AuraRemoteFileAccess remoteAccess,
            AuraCollaborationHub collaboration,
            AuraAuthenticationHub auth)
        {
            _remoteAccess = remoteAccess;
            _collaboration = collaboration;
            _auth = auth;

            Debug.WriteLine("[SMART SHARING]: Initialized with dual-method support");
        }

        #region Connection Detection

        public async Task<ConnectionQuality> DetectConnectionQualityAsync()
        {
            /*
             * Detect user's connection quality
             * Uses cached result if tested within last 5 minutes
             */

            if ((DateTime.Now - _lastSpeedTest).TotalMinutes < 5)
            {
                Debug.WriteLine($"[SMART SHARING]: Using cached speed test ({_uploadSpeedMbps:F1} Mbps up)");
                return ClassifyConnection(_uploadSpeedMbps);
            }

            Debug.WriteLine("[SMART SHARING]: Running speed test...");

            try
            {
                // Quick speed test (download small file, measure time)
                var speedTest = await RunQuickSpeedTestAsync();
                _uploadSpeedMbps = speedTest.UploadMbps;
                _downloadSpeedMbps = speedTest.DownloadMbps;
                _lastSpeedTest = DateTime.Now;

                var quality = ClassifyConnection(_uploadSpeedMbps);

                Debug.WriteLine($"[SMART SHARING]: Connection quality: {quality}");
                Debug.WriteLine($"[SMART SHARING]: Upload: {_uploadSpeedMbps:F1} Mbps, Download: {_downloadSpeedMbps:F1} Mbps");

                return quality;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[SMART SHARING]: Speed test failed: {ex.Message}");
                // Assume fair connection if test fails
                return ConnectionQuality.Fair;
            }
        }

        private ConnectionQuality ClassifyConnection(double uploadMbps)
        {
            return uploadMbps switch
            {
                >= 50 => ConnectionQuality.Excellent,
                >= 10 => ConnectionQuality.Good,
                >= 5 => ConnectionQuality.Fair,
                >= 1 => ConnectionQuality.Poor,
                _ => ConnectionQuality.VeryPoor
            };
        }

        private async Task<(double UploadMbps, double DownloadMbps)> RunQuickSpeedTestAsync()
        {
            /*
             * Quick speed test (simple, not 100% accurate but fast)
             *
             * For production, integrate with speedtest.net API or similar
             * For now, estimate based on ping and network interface
             */

            await Task.Delay(100);  // Simulate test

            // Check network interface speed
            var interfaces = NetworkInterface.GetAllNetworkInterfaces()
                .Where(ni => ni.OperationalStatus == OperationalStatus.Up)
                .Where(ni => ni.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .ToList();

            if (!interfaces.Any())
            {
                Debug.WriteLine("[SMART SHARING]: No active network interfaces");
                return (1.0, 1.0);  // Assume poor connection
            }

            // Use fastest interface
            var fastestInterface = interfaces.OrderByDescending(ni => ni.Speed).First();
            var speedBps = fastestInterface.Speed;  // bits per second
            var speedMbps = speedBps / 1_000_000.0;

            // Real internet speed is usually 50-80% of interface speed
            var estimatedUpload = speedMbps * 0.3;    // Upload usually 30% of max
            var estimatedDownload = speedMbps * 0.6;  // Download usually 60% of max

            Debug.WriteLine($"[SMART SHARING]: Interface: {fastestInterface.Name} ({speedMbps:F0} Mbps)");

            return (estimatedUpload, estimatedDownload);
        }

        #endregion

        #region Smart Recommendation

        public async Task<SharingRecommendation> GetRecommendationAsync(FileShareOptions options)
        {
            /*
             * Analyze situation and recommend best sharing method
             */

            var fileInfo = new FileInfo(options.FilePath);
            var fileSizeBytes = fileInfo.Exists ? fileInfo.Length : 0;

            var quality = await DetectConnectionQualityAsync();

            // Check if recipient users are online (for P2P)
            bool allUsersOnline = CheckUsersOnline(options.ShareWithUserIds);

            // Calculate estimated times
            var p2pTime = EstimateP2PTime(fileSizeBytes, _uploadSpeedMbps);
            var uploadTime = EstimateUploadTime(fileSizeBytes, _uploadSpeedMbps);

            // Recommendation logic
            var recommendation = new SharingRecommendation
            {
                ConnectionQuality = quality,
                UploadSpeedMbps = _uploadSpeedMbps,
                DownloadSpeedMbps = _downloadSpeedMbps,
                FileSizeBytes = fileSizeBytes,
                EstimatedP2PTime = p2pTime,
                EstimatedUploadTime = uploadTime,
                BothUsersOnline = allUsersOnline
            };

            // Decision matrix
            if (quality == ConnectionQuality.VeryPoor)
            {
                // Very slow - cloud only
                recommendation.RecommendedMethod = SharingMethod.CloudUpload;
                recommendation.Reason = "Slow connection detected. Cloud upload recommended for reliable delivery.";
            }
            else if (!allUsersOnline)
            {
                // Recipients offline - must use cloud
                recommendation.RecommendedMethod = SharingMethod.CloudUpload;
                recommendation.Reason = "Recipients are offline. Cloud upload will deliver when they come online.";
            }
            else if (quality >= ConnectionQuality.Good && fileSizeBytes > 100 * 1024 * 1024)
            {
                // Good connection + large file - P2P better
                recommendation.RecommendedMethod = SharingMethod.P2P_RemoteAccess;
                recommendation.Reason = $"Fast connection + large file ({FormatFileSize(fileSizeBytes)}). P2P access saves upload time.";
            }
            else if (quality == ConnectionQuality.Poor)
            {
                // Poor connection - cloud safer
                recommendation.RecommendedMethod = SharingMethod.CloudUpload;
                recommendation.Reason = "Connection quality is unstable. Cloud upload ensures reliable delivery.";
            }
            else
            {
                // Fair/Good connection - either works, prefer P2P if recipients online
                if (allUsersOnline && fileSizeBytes < 1024 * 1024 * 1024)  // < 1GB
                {
                    recommendation.RecommendedMethod = SharingMethod.P2P_RemoteAccess;
                    recommendation.Reason = "Recipients are online. P2P provides instant access.";
                }
                else
                {
                    recommendation.RecommendedMethod = SharingMethod.CloudUpload;
                    recommendation.Reason = "Cloud upload provides guaranteed delivery and offline access.";
                }
            }

            Debug.WriteLine($"[SMART SHARING]: Recommendation: {recommendation.RecommendedMethod}");
            Debug.WriteLine($"[SMART SHARING]: Reason: {recommendation.Reason}");

            return recommendation;
        }

        private bool CheckUsersOnline(List<string> userIds)
        {
            // TODO: Check actual online status from messaging system
            // For now, return false to be conservative
            return false;
        }

        private TimeSpan EstimateP2PTime(long fileSizeBytes, double uploadMbps)
        {
            // P2P is streaming, so time = file_size / upload_speed
            var fileSizeMb = fileSizeBytes / 1024.0 / 1024.0;
            var timeSeconds = fileSizeMb * 8 / uploadMbps;  // 8 bits per byte
            return TimeSpan.FromSeconds(timeSeconds);
        }

        private TimeSpan EstimateUploadTime(long fileSizeBytes, double uploadMbps)
        {
            // Upload time + small overhead for cloud processing
            var fileSizeMb = fileSizeBytes / 1024.0 / 1024.0;
            var timeSeconds = (fileSizeMb * 8 / uploadMbps) * 1.2;  // 20% overhead
            return TimeSpan.FromSeconds(timeSeconds);
        }

        #endregion

        #region Smart Share Execution

        public async Task<string> ShareFileSmartAsync(FileShareOptions options)
        {
            /*
             * Smart file sharing with automatic or user-specified method
             */

            SharingMethod method = options.Method;

            // If automatic, get recommendation
            if (method == SharingMethod.Automatic)
            {
                var recommendation = await GetRecommendationAsync(options);
                method = recommendation.RecommendedMethod;

                Debug.WriteLine($"[SMART SHARING]: Auto-selected: {method}");
                Debug.WriteLine($"[SMART SHARING]: {recommendation.Reason}");
            }

            // Execute chosen method
            if (method == SharingMethod.P2P_RemoteAccess)
            {
                return await ShareViaP2PAsync(options);
            }
            else
            {
                return await ShareViaCloudAsync(options);
            }
        }

        private async Task<string> ShareViaP2PAsync(FileShareOptions options)
        {
            /*
             * P2P Remote Access Method
             * Files stay on your PC, stream to collaborators
             */

            Debug.WriteLine($"[SMART SHARING]: Using P2P remote access");
            Debug.WriteLine($"[SMART SHARING]: File: {Path.GetFileName(options.FilePath)}");

            var grant = await _remoteAccess.GrantFileAccessAsync(
                options.FilePath,
                options.ShareWithUserIds,
                options.AccessMode,
                options.ExpiresIn
            );

            Debug.WriteLine($"[SMART SHARING]: ✓ P2P access granted");
            Debug.WriteLine($"[SMART SHARING]: Grant ID: {grant.GrantId}");
            Debug.WriteLine($"[SMART SHARING]: Accessible to {grant.AllowedUserIds.Count} users");

            if (grant.IsFolder)
            {
                Debug.WriteLine($"[SMART SHARING]: Shared folder with {grant.IncludedFiles.Count} files");
            }

            // Notify users via messaging
            foreach (var userId in options.ShareWithUserIds)
            {
                await NotifyUserOfP2PAccess(userId, grant);
            }

            return grant.GrantId;
        }

        private async Task<string> ShareViaCloudAsync(FileShareOptions options)
        {
            /*
             * Cloud Upload Method
             * Upload to cloud, others download when convenient
             */

            Debug.WriteLine($"[SMART SHARING]: Using cloud upload");
            Debug.WriteLine($"[SMART SHARING]: File: {Path.GetFileName(options.FilePath)}");

            var file = await _collaboration.UploadFileAsync(
                options.FilePath,
                FileStorageLocation.SharedWorkspace,
                options.ShareWithUserIds
            );

            Debug.WriteLine($"[SMART SHARING]: ✓ Cloud upload complete");
            Debug.WriteLine($"[SMART SHARING]: File ID: {file.FileId}");
            Debug.WriteLine($"[SMART SHARING]: Size: {FormatFileSize(file.FileSizeBytes)}");

            // Notify users via messaging
            foreach (var userId in options.ShareWithUserIds)
            {
                await NotifyUserOfCloudFile(userId, file);
            }

            return file.FileId;
        }

        private async Task NotifyUserOfP2PAccess(string userId, RemoteAccessGrant grant)
        {
            var message = new
            {
                type = "p2p_file_access",
                grant_id = grant.GrantId,
                file_name = grant.FileName,
                is_folder = grant.IsFolder,
                access_mode = grant.AccessMode.ToString(),
                expires_at = grant.ExpiresAt,
                message = grant.IsFolder
                    ? $"📁 {grant.HostUserId} shared folder '{grant.FileName}' with you via P2P"
                    : $"📄 {grant.HostUserId} shared '{grant.FileName}' with you via P2P"
            };

            // TODO: Send via messaging system
            Debug.WriteLine($"[SMART SHARING]: Would notify {userId} of P2P access");
        }

        private async Task NotifyUserOfCloudFile(string userId, WorkspaceFile file)
        {
            var message = new
            {
                type = "cloud_file_shared",
                file_id = file.FileId,
                file_name = file.FileName,
                file_size = file.FileSizeBytes,
                uploaded_by = file.UploadedBy,
                message = $"☁️ {file.UploadedBy} uploaded '{file.FileName}' ({FormatFileSize(file.FileSizeBytes)}) to shared workspace"
            };

            // TODO: Send via messaging system
            Debug.WriteLine($"[SMART SHARING]: Would notify {userId} of cloud file");
        }

        #endregion

        #region User-Friendly Display

        public string GetMethodDescription(SharingMethod method, long fileSizeBytes, double uploadSpeedMbps)
        {
            var fileSize = FormatFileSize(fileSizeBytes);
            var estimatedTime = EstimateUploadTime(fileSizeBytes, uploadSpeedMbps);

            return method switch
            {
                SharingMethod.P2P_RemoteAccess =>
                    $"🔗 P2P Remote Access\n" +
                    $"• Files stay on your PC\n" +
                    $"• Instant access for collaborators\n" +
                    $"• No upload needed\n" +
                    $"• Requires you to be online\n" +
                    $"• Best for: Real-time collaboration",

                SharingMethod.CloudUpload =>
                    $"☁️ Cloud Upload\n" +
                    $"• Upload once to cloud\n" +
                    $"• Others download anytime\n" +
                    $"• Works offline after upload\n" +
                    $"• Upload time: ~{FormatTimeSpan(estimatedTime)}\n" +
                    $"• Best for: Slow connections, async work",

                _ => "Choose method automatically based on connection"
            };
        }

        public Dictionary<string, object> GetSharingStats()
        {
            return new Dictionary<string, object>
            {
                { "upload_speed_mbps", _uploadSpeedMbps },
                { "download_speed_mbps", _downloadSpeedMbps },
                { "connection_quality", ClassifyConnection(_uploadSpeedMbps).ToString() },
                { "last_speed_test", _lastSpeedTest },
                { "p2p_available", _uploadSpeedMbps >= 1.0 },
                { "cloud_available", true }
            };
        }

        #endregion

        #region Utilities

        private string FormatFileSize(long bytes)
        {
            string[] sizes = { "B", "KB", "MB", "GB", "TB" };
            double len = bytes;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len /= 1024;
            }
            return $"{len:F1} {sizes[order]}";
        }

        private string FormatTimeSpan(TimeSpan time)
        {
            if (time.TotalSeconds < 60)
                return $"{time.TotalSeconds:F0}s";
            if (time.TotalMinutes < 60)
                return $"{time.TotalMinutes:F0}m";
            return $"{time.TotalHours:F1}h";
        }

        #endregion
    }

    #region Usage Example

    public static class SmartFileSharingExample
    {
        public static async Task QuickStart()
        {
            var auth = new AuraAuthenticationHub();
            var remoteAccess = new AuraRemoteFileAccess();
            var collaboration = new AuraCollaborationHub(auth);

            var smartSharing = new AuraSmartFileSharing(remoteAccess, collaboration, auth);

            // Get recommendation
            var options = new FileShareOptions
            {
                FilePath = "D:/MyProject/large_file.zip",
                ShareWithUserIds = new List<string> { "user123", "user456" },
                Method = SharingMethod.Automatic  // Let system decide
            };

            var recommendation = await smartSharing.GetRecommendationAsync(options);

            Debug.WriteLine($"Recommended: {recommendation.RecommendedMethod}");
            Debug.WriteLine($"Reason: {recommendation.Reason}");
            Debug.WriteLine($"P2P time: {recommendation.EstimatedP2PTime.TotalMinutes:F1} minutes");
            Debug.WriteLine($"Upload time: {recommendation.EstimatedUploadTime.TotalMinutes:F1} minutes");

            // Let user choose
            Debug.WriteLine("\nOptions:");
            Debug.WriteLine(smartSharing.GetMethodDescription(SharingMethod.P2P_RemoteAccess, recommendation.FileSizeBytes, recommendation.UploadSpeedMbps));
            Debug.WriteLine("\n" + smartSharing.GetMethodDescription(SharingMethod.CloudUpload, recommendation.FileSizeBytes, recommendation.UploadSpeedMbps));

            // Share with chosen method (or automatic)
            var shareId = await smartSharing.ShareFileSmartAsync(options);

            Debug.WriteLine($"\n✓ Shared successfully: {shareId}");
        }
    }

    #endregion
}
