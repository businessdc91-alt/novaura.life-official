/*
 * AURA REMOTE FILE ACCESS - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: P2P remote access to local files (no upload needed!)
 *
 * REVOLUTIONARY FEATURE:
 * - Files stay on host's local PC
 * - Remote users can view/edit in real-time
 * - Like screen share but for individual files
 * - Works as long as host is online
 * - Automatic sync of changes
 * - Temporary access tokens
 *
 * USE CASES:
 * - Collaborate on code without uploading
 * - Review designs in real-time
 * - Live document editing
 * - Instant file sharing (no cloud needed)
 *
 * SECURITY:
 * - Time-limited access tokens
 * - Read-only or full access modes
 * - File permissions controlled by host
 * - Automatic disconnect when host offline
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text;

namespace AuraxNova_Command_v5.Core
{
    public enum RemoteAccessMode
    {
        ReadOnly,       // Can view only
        ReadWrite,      // Can edit (syncs back to host)
        FullControl     // Can view, edit, delete
    }

    public class RemoteAccessGrant
    {
        public string GrantId { get; set; }
        public string FilePath { get; set; }  // Local path on host (file or folder)
        public string FileName { get; set; }
        public bool IsFolder { get; set; }  // True if sharing entire folder
        public List<string> IncludedFiles { get; set; } = new();  // Files in folder (if folder)
        public string HostUserId { get; set; }
        public List<string> AllowedUserIds { get; set; } = new();
        public RemoteAccessMode AccessMode { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsActive { get; set; }
        public Dictionary<string, DateTime> ActiveViewers { get; set; } = new();  // userId -> lastSeen
    }

    public class RemoteFileStream
    {
        public string StreamId { get; set; }
        public string GrantId { get; set; }
        public string UserId { get; set; }
        public long FilePosition { get; set; }
        public byte[] Buffer { get; set; }
        public DateTime LastActivity { get; set; }
    }

    public class FileChangeEvent
    {
        public string GrantId { get; set; }
        public string UserId { get; set; }
        public string ChangeType { get; set; }  // "edit", "save", "close"
        public long Position { get; set; }
        public byte[] Data { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class AuraRemoteFileAccess
    {
        private readonly string _dataPath = "E:/AuraNova_DataLake/RemoteAccess";
        private readonly AuraMessaging _messaging;

        // Active grants (files being shared)
        private readonly Dictionary<string, RemoteAccessGrant> _activeGrants = new();

        // Active streams (remote users viewing/editing)
        private readonly Dictionary<string, RemoteFileStream> _activeStreams = new();

        // File watchers for change detection
        private readonly Dictionary<string, FileSystemWatcher> _fileWatchers = new();

        // Events
        public event Action<RemoteAccessGrant> OnAccessGranted;
        public event Action<RemoteAccessGrant> OnAccessRevoked;
        public event Action<FileChangeEvent> OnRemoteChange;

        public AuraRemoteFileAccess(AuraMessaging messaging)
        {
            _messaging = messaging;
            Directory.CreateDirectory(_dataPath);

            Debug.WriteLine("[REMOTE ACCESS]: Initialized");
            Debug.WriteLine("[REMOTE ACCESS]: P2P file access ready");
        }

        // Parameterless constructor for AuraMasterInit/AuraSmartFileSharing compatibility
        public AuraRemoteFileAccess() : this(new AuraMessaging())
        {
        }

        #region Grant Access (Host Side)

        public async Task<RemoteAccessGrant> GrantFileAccessAsync(
            string filePath,
            List<string> allowedUserIds,
            RemoteAccessMode accessMode,
            TimeSpan expiresIn)
        {
            /*
             * Grant remote access to a local file OR FOLDER
             * Entire project folders can be shared remotely!
             */

            bool isFolder = Directory.Exists(filePath);
            bool isFile = File.Exists(filePath);

            if (!isFolder && !isFile)
                throw new FileNotFoundException($"Path not found: {filePath}");

            var grant = new RemoteAccessGrant
            {
                GrantId = GenerateGrantId(),
                FilePath = filePath,
                FileName = isFolder ? Path.GetFileName(filePath) : Path.GetFileName(filePath),
                IsFolder = isFolder,
                HostUserId = "current_user",  // TODO: Get from session
                AllowedUserIds = allowedUserIds,
                AccessMode = accessMode,
                CreatedAt = DateTime.Now,
                ExpiresAt = DateTime.Now.Add(expiresIn),
                IsActive = true
            };

            // If folder, index all files
            if (isFolder)
            {
                grant.IncludedFiles = Directory.GetFiles(filePath, "*.*", SearchOption.AllDirectories)
                    .Select(f => Path.GetRelativePath(filePath, f))
                    .ToList();

                Debug.WriteLine($"[REMOTE ACCESS]: Sharing folder with {grant.IncludedFiles.Count} files");
            }

            _activeGrants[grant.GrantId] = grant;

            // Set up file watcher for changes
            SetupFileWatcher(grant);

            // Save grant info
            await SaveGrantAsync(grant);

            // Get file info for size
            var fileSize = isFile ? new FileInfo(filePath).Length : 0L;

            // Notify allowed users
            foreach (var userId in allowedUserIds)
            {
                await _messaging.SendDirectMessageAsync(userId, new
                {
                    type = "remote_access_granted",
                    grant_id = grant.GrantId,
                    file_name = grant.FileName,
                    file_size = fileSize,
                    access_mode = grant.AccessMode.ToString(),
                    expires_at = grant.ExpiresAt,
                    message = $"You have been granted {grant.AccessMode} access to {grant.FileName}"
                });
            }

            Debug.WriteLine($"[REMOTE ACCESS]: ✓ Granted {accessMode} access to {grant.FileName}");
            Debug.WriteLine($"[REMOTE ACCESS]: Allowed users: {string.Join(", ", allowedUserIds)}");
            Debug.WriteLine($"[REMOTE ACCESS]: Expires: {grant.ExpiresAt}");

            OnAccessGranted?.Invoke(grant);

            return grant;
        }

        public async Task RevokeAccessAsync(string grantId)
        {
            /*
             * Revoke remote access to file
             */

            if (!_activeGrants.ContainsKey(grantId))
                return;

            var grant = _activeGrants[grantId];
            grant.IsActive = false;

            // Disconnect all active viewers
            foreach (var userId in grant.ActiveViewers.Keys.ToList())
            {
                await DisconnectRemoteUserAsync(grantId, userId);
            }

            // Stop file watcher
            if (_fileWatchers.ContainsKey(grantId))
            {
                _fileWatchers[grantId].Dispose();
                _fileWatchers.Remove(grantId);
            }

            _activeGrants.Remove(grantId);

            Debug.WriteLine($"[REMOTE ACCESS]: ✓ Access revoked for {grant.FileName}");

            OnAccessRevoked?.Invoke(grant);
        }

        #endregion

        #region Request Access (Remote User Side)

        public async Task<RemoteFileStream> RequestFileAccessAsync(string grantId, string userId)
        {
            /*
             * Remote user requests access to file
             * Returns stream for reading/writing
             */

            // Send request to host
            // In production, this would go through SignalR to host
            var request = new
            {
                type = "file_access_request",
                grant_id = grantId,
                user_id = userId
            };

            // Simulate host approval (in production, host approves/denies)
            await Task.Delay(100);

            // Create stream
            var stream = new RemoteFileStream
            {
                StreamId = Guid.NewGuid().ToString(),
                GrantId = grantId,
                UserId = userId,
                FilePosition = 0,
                LastActivity = DateTime.Now
            };

            _activeStreams[stream.StreamId] = stream;

            Debug.WriteLine($"[REMOTE ACCESS]: ✓ Stream opened for user {userId}");

            return stream;
        }

        #endregion

        #region File Streaming (Host → Remote)

        public async Task<byte[]> ReadRemoteFileChunkAsync(string streamId, long position, int chunkSize)
        {
            /*
             * Read chunk of file from host
             * Called by remote user to get file data
             */

            if (!_activeStreams.ContainsKey(streamId))
                throw new Exception("Stream not found or expired");

            var stream = _activeStreams[streamId];
            var grant = _activeGrants[stream.GrantId];

            if (!grant.IsActive)
                throw new Exception("Access grant has been revoked");

            // Update activity
            stream.LastActivity = DateTime.Now;
            stream.FilePosition = position;

            // Read from local file
            using var fileStream = File.OpenRead(grant.FilePath);
            fileStream.Seek(position, SeekOrigin.Begin);

            var buffer = new byte[chunkSize];
            var bytesRead = await fileStream.ReadAsync(buffer, 0, chunkSize);

            // Return only what was read
            if (bytesRead < chunkSize)
            {
                Array.Resize(ref buffer, bytesRead);
            }

            Debug.WriteLine($"[REMOTE ACCESS]: Sent {bytesRead} bytes to remote user");

            return buffer;
        }

        #endregion

        #region File Editing (Remote → Host)

        public async Task WriteRemoteFileChunkAsync(string streamId, long position, byte[] data)
        {
            /*
             * Write changes from remote user back to host file
             * Only allowed with ReadWrite or FullControl access
             */

            if (!_activeStreams.ContainsKey(streamId))
                throw new Exception("Stream not found or expired");

            var stream = _activeStreams[streamId];
            var grant = _activeGrants[stream.GrantId];

            if (!grant.IsActive)
                throw new Exception("Access grant has been revoked");

            if (grant.AccessMode == RemoteAccessMode.ReadOnly)
                throw new UnauthorizedAccessException("Read-only access - cannot write");

            // Update activity
            stream.LastActivity = DateTime.Now;

            // Write to local file
            using var fileStream = File.OpenWrite(grant.FilePath);
            fileStream.Seek(position, SeekOrigin.Begin);
            await fileStream.WriteAsync(data, 0, data.Length);

            Debug.WriteLine($"[REMOTE ACCESS]: Wrote {data.Length} bytes from remote user");

            // Broadcast change to other viewers
            var changeEvent = new FileChangeEvent
            {
                GrantId = grant.GrantId,
                UserId = stream.UserId,
                ChangeType = "edit",
                Position = position,
                Data = data,
                Timestamp = DateTime.Now
            };

            await BroadcastFileChangeAsync(grant, changeEvent, stream.UserId);

            OnRemoteChange?.Invoke(changeEvent);
        }

        #endregion

        #region Change Broadcasting

        private void SetupFileWatcher(RemoteAccessGrant grant)
        {
            /*
             * Watch for local file changes and broadcast to remote users
             */

            var watcher = new FileSystemWatcher(Path.GetDirectoryName(grant.FilePath))
            {
                Filter = Path.GetFileName(grant.FilePath),
                NotifyFilter = NotifyFilters.LastWrite
            };

            watcher.Changed += async (sender, e) =>
            {
                Debug.WriteLine($"[REMOTE ACCESS]: Local file changed - broadcasting to remote users");

                var changeEvent = new FileChangeEvent
                {
                    GrantId = grant.GrantId,
                    UserId = grant.HostUserId,
                    ChangeType = "edit",
                    Timestamp = DateTime.Now
                };

                await BroadcastFileChangeAsync(grant, changeEvent, grant.HostUserId);
            };

            watcher.EnableRaisingEvents = true;
            _fileWatchers[grant.GrantId] = watcher;
        }

        private async Task BroadcastFileChangeAsync(RemoteAccessGrant grant, FileChangeEvent changeEvent, string excludeUserId)
        {
            /*
             * Broadcast file change to all active viewers (except the one who made the change)
             */

            foreach (var userId in grant.ActiveViewers.Keys)
            {
                if (userId == excludeUserId)
                    continue;

                await _messaging.SendDirectMessageAsync(userId, new
                {
                    type = "file_change",
                    grant_id = grant.GrantId,
                    change = changeEvent
                });
            }
        }

        #endregion

        #region Session Management

        public async Task<List<RemoteAccessGrant>> GetActiveGrantsAsync()
        {
            /*
             * Get all active file access grants
             */

            // Remove expired grants
            var expired = _activeGrants.Values.Where(g => DateTime.Now > g.ExpiresAt).ToList();
            foreach (var grant in expired)
            {
                await RevokeAccessAsync(grant.GrantId);
            }

            return _activeGrants.Values.Where(g => g.IsActive).ToList();
        }

        public List<string> GetActiveViewers(string grantId)
        {
            /*
             * Get users currently viewing/editing file
             */

            if (!_activeGrants.ContainsKey(grantId))
                return new List<string>();

            var grant = _activeGrants[grantId];

            // Remove inactive viewers (no activity in last 30 seconds)
            var cutoff = DateTime.Now.AddSeconds(-30);
            var inactive = grant.ActiveViewers.Where(kvp => kvp.Value < cutoff).Select(kvp => kvp.Key).ToList();

            foreach (var userId in inactive)
            {
                grant.ActiveViewers.Remove(userId);
                Debug.WriteLine($"[REMOTE ACCESS]: User {userId} timed out");
            }

            return grant.ActiveViewers.Keys.ToList();
        }

        private async Task DisconnectRemoteUserAsync(string grantId, string userId)
        {
            /*
             * Disconnect remote user from file
             */

            // Close their streams
            var userStreams = _activeStreams.Values.Where(s => s.GrantId == grantId && s.UserId == userId).ToList();
            foreach (var stream in userStreams)
            {
                _activeStreams.Remove(stream.StreamId);
            }

            // Remove from active viewers
            if (_activeGrants.ContainsKey(grantId))
            {
                _activeGrants[grantId].ActiveViewers.Remove(userId);
            }

            // Notify user
            await _messaging.SendDirectMessageAsync(userId, new
            {
                type = "access_revoked",
                grant_id = grantId,
                message = "File access has been revoked"
            });

            Debug.WriteLine($"[REMOTE ACCESS]: Disconnected user {userId}");
        }

        #endregion

        #region Helpers

        private async Task SaveGrantAsync(RemoteAccessGrant grant)
        {
            var path = Path.Combine(_dataPath, $"{grant.GrantId}.json");
            var json = JsonSerializer.Serialize(grant, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(path, json);
        }

        private string GenerateGrantId()
        {
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[16];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        }

        #endregion

        #region Statistics

        public Dictionary<string, object> GetStats()
        {
            return new Dictionary<string, object>
            {
                { "active_grants", _activeGrants.Count },
                { "active_streams", _activeStreams.Count },
                { "total_viewers", _activeGrants.Values.Sum(g => g.ActiveViewers.Count) },
                { "files_shared", _activeGrants.Values.Select(g => g.FilePath).Distinct().Count() }
            };
        }

        #endregion
    }

    #region Usage Examples

    public static class RemoteFileAccessExamples
    {
        public static async Task HostSharesFile()
        {
            var messaging = new AuraMessaging();
            var remoteAccess = new AuraRemoteFileAccess(messaging);

            // Host shares a local file
            var grant = await remoteAccess.GrantFileAccessAsync(
                filePath: "D:/MyProject/important_code.cs",
                allowedUserIds: new List<string> { "user_123", "user_456" },
                accessMode: RemoteAccessMode.ReadWrite,  // They can edit
                expiresIn: TimeSpan.FromHours(2)  // Access expires in 2 hours
            );

            Debug.WriteLine($"Grant ID: {grant.GrantId}");
            Debug.WriteLine("File is now accessible remotely - no upload needed!");
            Debug.WriteLine("Changes from remote users will sync back automatically");
        }

        public static async Task RemoteUserAccessesFile()
        {
            var messaging = new AuraMessaging();
            var remoteAccess = new AuraRemoteFileAccess(messaging);

            // Remote user accesses the file
            var stream = await remoteAccess.RequestFileAccessAsync("grant_id_here", "user_123");

            // Read file content
            var data = await remoteAccess.ReadRemoteFileChunkAsync(stream.StreamId, position: 0, chunkSize: 1024);

            Debug.WriteLine($"Read {data.Length} bytes from host's PC");

            // Make changes (if allowed)
            var changes = Encoding.UTF8.GetBytes("// Updated remotely!");
            await remoteAccess.WriteRemoteFileChunkAsync(stream.StreamId, position: 0, changes);

            Debug.WriteLine("Changes synced back to host!");
        }
    }

    #endregion
}
