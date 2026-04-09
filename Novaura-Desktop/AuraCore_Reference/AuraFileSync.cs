/*
 * AURA FILE SYNC - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Automatic file synchronization between local/cloud/collaborators
 *
 * FEATURES:
 * - Offline-first with local SQLite
 * - Automatic sync when online
 * - Conflict resolution
 * - Real-time collaboration (like Google Docs sync)
 * - Version history
 * - Automatic change detection
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using Microsoft.Data.Sqlite;

namespace AuraxNova_Command_v5.Core
{
    public enum FileSyncStatus
    {
        Synced,
        PendingUpload,
        PendingDownload,
        Conflict,
        Error
    }

    public class FileSyncRecord
    {
        public string FileId { get; set; }
        public string LocalPath { get; set; }
        public string CloudPath { get; set; }
        public string FileHash { get; set; }  // MD5 for change detection
        public DateTime LastModified { get; set; }
        public DateTime LastSynced { get; set; }
        public FileSyncStatus Status { get; set; }
        public long FileSizeBytes { get; set; }
        public bool IsShared { get; set; }
        public List<string> SharedWith { get; set; } = new();
    }

    public class AuraFileSync
    {
        private readonly string _workspacePath;
        private readonly string _dbPath;
        private readonly Dictionary<string, FileSyncRecord> _syncCache = new();
        private readonly FileSystemWatcher _watcher;

        public AuraFileSync(string workspacePath)
        {
            _workspacePath = workspacePath;
            _dbPath = Path.Combine(workspacePath, ".aura_sync.db");

            Directory.CreateDirectory(_workspacePath);

            InitializeDatabase();
            LoadSyncCache();

            // Watch for file changes
            _watcher = new FileSystemWatcher(_workspacePath)
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size,
                IncludeSubdirectories = true
            };

            _watcher.Changed += OnFileChanged;
            _watcher.Created += OnFileCreated;
            _watcher.Deleted += OnFileDeleted;
            _watcher.Renamed += OnFileRenamed;

            _watcher.EnableRaisingEvents = true;

            Debug.WriteLine("[FILE SYNC]: Initialized");
            Debug.WriteLine($"[FILE SYNC]: Watching {_workspacePath}");
        }

        #region Database

        private void InitializeDatabase()
        {
            // SQLite will automatically create the file when connection is opened

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            connection.Open();

            var createTable = @"
                CREATE TABLE IF NOT EXISTS sync_records (
                    file_id TEXT PRIMARY KEY,
                    local_path TEXT,
                    cloud_path TEXT,
                    file_hash TEXT,
                    last_modified TEXT,
                    last_synced TEXT,
                    status TEXT,
                    file_size INTEGER,
                    is_shared INTEGER,
                    shared_with TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_local_path ON sync_records(local_path);
                CREATE INDEX IF NOT EXISTS idx_status ON sync_records(status);
            ";

            using var command = new SqliteCommand(createTable, connection);
            command.ExecuteNonQuery();
        }

        #endregion

        #region File Registration

        public async Task RegisterLocalFileAsync(WorkspaceFile file)
        {
            /*
             * Register a local-only file in sync system
             */

            var record = new FileSyncRecord
            {
                FileId = file.FileId,
                LocalPath = file.FilePath,
                CloudPath = null,
                FileHash = ComputeFileHash(file.FilePath),
                LastModified = File.GetLastWriteTime(file.FilePath),
                LastSynced = DateTime.Now,
                Status = FileSyncStatus.Synced,
                FileSizeBytes = file.FileSizeBytes,
                IsShared = false
            };

            await SaveSyncRecordAsync(record);

            Debug.WriteLine($"[FILE SYNC]: Registered local file: {file.FileName}");
        }

        public async Task RegisterCloudFileAsync(WorkspaceFile file)
        {
            /*
             * Register a cloud-backed file
             */

            var record = new FileSyncRecord
            {
                FileId = file.FileId,
                LocalPath = null,  // Not downloaded yet
                CloudPath = file.FilePath,
                FileHash = null,  // Will be set when downloaded
                LastModified = file.UploadedAt,
                LastSynced = DateTime.Now,
                Status = FileSyncStatus.Synced,
                FileSizeBytes = file.FileSizeBytes,
                IsShared = file.IsShared,
                SharedWith = file.SharedWith
            };

            await SaveSyncRecordAsync(record);

            Debug.WriteLine($"[FILE SYNC]: Registered cloud file: {file.FileName}");
        }

        public async Task RegisterSharedFileAsync(WorkspaceFile file, List<string> sharedWith)
        {
            /*
             * Register a shared file (visible to multiple users)
             */

            var record = new FileSyncRecord
            {
                FileId = file.FileId,
                LocalPath = null,
                CloudPath = file.FilePath,
                FileHash = null,
                LastModified = file.UploadedAt,
                LastSynced = DateTime.Now,
                Status = FileSyncStatus.Synced,
                FileSizeBytes = file.FileSizeBytes,
                IsShared = true,
                SharedWith = sharedWith
            };

            await SaveSyncRecordAsync(record);

            Debug.WriteLine($"[FILE SYNC]: Registered shared file: {file.FileName}");
        }

        #endregion

        #region Change Detection

        private void OnFileChanged(object sender, FileSystemEventArgs e)
        {
            /*
             * File was modified - mark for sync
             */

            Debug.WriteLine($"[FILE SYNC]: File changed: {e.Name}");

            var record = _syncCache.Values.FirstOrDefault(r => r.LocalPath == e.FullPath);
            if (record != null)
            {
                var newHash = ComputeFileHash(e.FullPath);
                if (newHash != record.FileHash)
                {
                    record.FileHash = newHash;
                    record.LastModified = DateTime.Now;
                    record.Status = FileSyncStatus.PendingUpload;

                    SaveSyncRecordAsync(record).Wait();

                    Debug.WriteLine($"[FILE SYNC]: ⏳ Marked for upload: {e.Name}");
                }
            }
        }

        private void OnFileCreated(object sender, FileSystemEventArgs e)
        {
            Debug.WriteLine($"[FILE SYNC]: File created: {e.Name}");
            // Auto-register new files in workspace
        }

        private void OnFileDeleted(object sender, FileSystemEventArgs e)
        {
            Debug.WriteLine($"[FILE SYNC]: File deleted: {e.Name}");
            // Mark for deletion sync
        }

        private void OnFileRenamed(object sender, RenamedEventArgs e)
        {
            Debug.WriteLine($"[FILE SYNC]: File renamed: {e.OldName} → {e.Name}");
            // Update local path in sync record
        }

        #endregion

        #region Sync Operations

        public async Task<List<FileSyncRecord>> GetPendingUploadsAsync()
        {
            /*
             * Get files that need to be uploaded
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT * FROM sync_records WHERE status = 'PendingUpload'";
            using var command = new SqliteCommand(query, connection);

            var pending = new List<FileSyncRecord>();

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                pending.Add(ReadSyncRecord(reader));
            }

            return pending;
        }

        public async Task<List<FileSyncRecord>> GetPendingDownloadsAsync()
        {
            /*
             * Get files that need to be downloaded
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT * FROM sync_records WHERE status = 'PendingDownload'";
            using var command = new SqliteCommand(query, connection);

            var pending = new List<FileSyncRecord>();

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                pending.Add(ReadSyncRecord(reader));
            }

            return pending;
        }

        public async Task<List<WorkspaceFile>> GetSharedFilesAsync(string groupId)
        {
            /*
             * Get all shared files for a group
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT * FROM sync_records WHERE is_shared = 1";
            using var command = new SqliteCommand(query, connection);

            var files = new List<WorkspaceFile>();

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var record = ReadSyncRecord(reader);

                files.Add(new WorkspaceFile
                {
                    FileId = record.FileId,
                    FileName = Path.GetFileName(record.LocalPath ?? record.CloudPath),
                    FileSizeBytes = record.FileSizeBytes,
                    FilePath = record.CloudPath,
                    Location = FileStorageLocation.SharedWorkspace,
                    IsShared = true,
                    SharedWith = record.SharedWith
                });
            }

            return files;
        }

        public async Task MarkSyncedAsync(string fileId)
        {
            /*
             * Mark file as successfully synced
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var update = @"
                UPDATE sync_records
                SET status = 'Synced', last_synced = @now
                WHERE file_id = @fileId
            ";

            using var command = new SqliteCommand(update, connection);
            command.Parameters.AddWithValue("@now", DateTime.Now.ToString("O"));
            command.Parameters.AddWithValue("@fileId", fileId);

            await command.ExecuteNonQueryAsync();

            // Update cache
            if (_syncCache.ContainsKey(fileId))
            {
                _syncCache[fileId].Status = FileSyncStatus.Synced;
                _syncCache[fileId].LastSynced = DateTime.Now;
            }
        }

        #endregion

        #region Helpers

        private async Task SaveSyncRecordAsync(FileSyncRecord record)
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var upsert = @"
                INSERT OR REPLACE INTO sync_records
                (file_id, local_path, cloud_path, file_hash, last_modified, last_synced, status, file_size, is_shared, shared_with)
                VALUES
                (@id, @local, @cloud, @hash, @modified, @synced, @status, @size, @shared, @sharedWith)
            ";

            using var command = new SqliteCommand(upsert, connection);
            command.Parameters.AddWithValue("@id", record.FileId);
            command.Parameters.AddWithValue("@local", record.LocalPath ?? "");
            command.Parameters.AddWithValue("@cloud", record.CloudPath ?? "");
            command.Parameters.AddWithValue("@hash", record.FileHash ?? "");
            command.Parameters.AddWithValue("@modified", record.LastModified.ToString("O"));
            command.Parameters.AddWithValue("@synced", record.LastSynced.ToString("O"));
            command.Parameters.AddWithValue("@status", record.Status.ToString());
            command.Parameters.AddWithValue("@size", record.FileSizeBytes);
            command.Parameters.AddWithValue("@shared", record.IsShared ? 1 : 0);
            command.Parameters.AddWithValue("@sharedWith", JsonSerializer.Serialize(record.SharedWith));

            await command.ExecuteNonQueryAsync();

            // Update cache
            _syncCache[record.FileId] = record;
        }

        private FileSyncRecord ReadSyncRecord(SqliteDataReader reader)
        {
            var sharedWith = new List<string>();
            try
            {
                sharedWith = JsonSerializer.Deserialize<List<string>>(reader.GetString(9)) ?? new List<string>();
            }
            catch { }

            return new FileSyncRecord
            {
                FileId = reader.GetString(0),
                LocalPath = reader.GetString(1),
                CloudPath = reader.GetString(2),
                FileHash = reader.GetString(3),
                LastModified = DateTime.Parse(reader.GetString(4)),
                LastSynced = DateTime.Parse(reader.GetString(5)),
                Status = Enum.Parse<FileSyncStatus>(reader.GetString(6)),
                FileSizeBytes = reader.GetInt64(7),
                IsShared = reader.GetInt32(8) == 1,
                SharedWith = sharedWith
            };
        }

        private void LoadSyncCache()
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            connection.Open();

            var query = "SELECT * FROM sync_records";
            using var command = new SqliteCommand(query, connection);
            using var reader = command.ExecuteReader();

            while (reader.Read())
            {
                var record = ReadSyncRecord(reader);
                _syncCache[record.FileId] = record;
            }

            Debug.WriteLine($"[FILE SYNC]: Loaded {_syncCache.Count} sync records");
        }

        private string ComputeFileHash(string filePath)
        {
            if (!File.Exists(filePath))
                return null;

            using var md5 = MD5.Create();
            using var stream = File.OpenRead(filePath);
            var hash = md5.ComputeHash(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLower();
        }

        #endregion

        public void Dispose()
        {
            _watcher?.Dispose();
        }
    }
}
