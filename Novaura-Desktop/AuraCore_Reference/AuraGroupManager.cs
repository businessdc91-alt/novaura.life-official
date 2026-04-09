/*
 * AURA GROUP MANAGER - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Manage organization-based groups and membership
 *
 * FEATURES:
 * - Create/join groups
 * - Check group existence before auth
 * - Member management
 * - Storage quotas per group
 * - Offline-first with SQLite
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using Microsoft.Data.Sqlite;

namespace AuraxNova_Command_v5.Core
{
    public class AuraGroupManager
    {
        private readonly string _dataPath;
        private readonly string _dbPath;
        private readonly Dictionary<string, WorkspaceGroup> _groupsCache = new();

        public AuraGroupManager(string dataPath)
        {
            _dataPath = dataPath;
            _dbPath = Path.Combine(_dataPath, "groups.db");

            InitializeDatabase();
            LoadGroupsCache();

            Debug.WriteLine("[GROUP MANAGER]: Initialized");
        }

        #region Database

        private void InitializeDatabase()
        {
            /*
             * Create SQLite database for offline-first storage
             * SQLite will automatically create the file when connection is opened
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            connection.Open();

            var createTable = @"
                CREATE TABLE IF NOT EXISTS groups (
                    group_id TEXT PRIMARY KEY,
                    group_name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    owner_id TEXT,
                    created TEXT,
                    storage_used INTEGER,
                    storage_limit INTEGER,
                    settings TEXT
                );

                CREATE TABLE IF NOT EXISTS group_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id TEXT,
                    user_id TEXT,
                    joined_at TEXT,
                    role TEXT DEFAULT 'member',
                    UNIQUE(group_id, user_id)
                );

                CREATE INDEX IF NOT EXISTS idx_group_name ON groups(group_name);
                CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(group_id, user_id);
            ";

            using var command = new SqliteCommand(createTable, connection);
            command.ExecuteNonQuery();
        }

        #endregion

        #region Group Management

        public async Task<bool> CheckGroupExistsAsync(string groupName)
        {
            /*
             * Check if group exists (for pre-auth validation)
             */

            // Check cache first
            if (_groupsCache.Values.Any(g => g.GroupName.Equals(groupName, StringComparison.OrdinalIgnoreCase)))
                return true;

            // Check database
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT COUNT(*) FROM groups WHERE group_name = @name COLLATE NOCASE";
            using var command = new SqliteCommand(query, connection);
            command.Parameters.AddWithValue("@name", groupName);

            var count = Convert.ToInt32(await command.ExecuteScalarAsync());

            return count > 0;
        }

        public async Task<WorkspaceGroup> CreateGroupAsync(
            string groupName,
            string description,
            string ownerId,
            long storageLimitBytes = 20L * 1024 * 1024 * 1024)  // 20GB default
        {
            /*
             * Create a new group
             */

            // Check if exists
            if (await CheckGroupExistsAsync(groupName))
                throw new Exception($"Group '{groupName}' already exists");

            var group = new WorkspaceGroup
            {
                GroupId = Guid.NewGuid().ToString(),
                GroupName = groupName,
                Description = description,
                OwnerId = ownerId,
                Created = DateTime.Now,
                StorageUsedBytes = 0,
                StorageLimitBytes = storageLimitBytes,
                MemberIds = new List<string> { ownerId }  // Owner is first member
            };

            // Save to database
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var insert = @"
                INSERT INTO groups (group_id, group_name, description, owner_id, created, storage_used, storage_limit, settings)
                VALUES (@id, @name, @desc, @owner, @created, @used, @limit, @settings)
            ";

            using var command = new SqliteCommand(insert, connection);
            command.Parameters.AddWithValue("@id", group.GroupId);
            command.Parameters.AddWithValue("@name", group.GroupName);
            command.Parameters.AddWithValue("@desc", group.Description);
            command.Parameters.AddWithValue("@owner", group.OwnerId);
            command.Parameters.AddWithValue("@created", group.Created.ToString("O"));
            command.Parameters.AddWithValue("@used", group.StorageUsedBytes);
            command.Parameters.AddWithValue("@limit", group.StorageLimitBytes);
            command.Parameters.AddWithValue("@settings", JsonSerializer.Serialize(group.Settings));

            await command.ExecuteNonQueryAsync();

            // Add owner as member
            await AddMemberToGroupAsync(group.GroupId, ownerId, "owner");

            // Update cache
            _groupsCache[group.GroupId] = group;

            Debug.WriteLine($"[GROUP MANAGER]: Created group '{groupName}' ({group.GroupId})");

            return group;
        }

        public async Task<WorkspaceGroup> GetGroupAsync(string groupName)
        {
            /*
             * Get group by name
             */

            // Check cache
            var cached = _groupsCache.Values.FirstOrDefault(g =>
                g.GroupName.Equals(groupName, StringComparison.OrdinalIgnoreCase));

            if (cached != null)
                return cached;

            // Load from database
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT * FROM groups WHERE group_name = @name COLLATE NOCASE";
            using var command = new SqliteCommand(query, connection);
            command.Parameters.AddWithValue("@name", groupName);

            using var reader = await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return null;

            var group = new WorkspaceGroup
            {
                GroupId = reader.GetString(0),
                GroupName = reader.GetString(1),
                Description = reader.GetString(2),
                OwnerId = reader.GetString(3),
                Created = DateTime.Parse(reader.GetString(4)),
                StorageUsedBytes = reader.GetInt64(5),
                StorageLimitBytes = reader.GetInt64(6),
                Settings = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(7))
            };

            // Load members
            group.MemberIds = await GetGroupMemberIdsAsync(group.GroupId);

            // Cache
            _groupsCache[group.GroupId] = group;

            return group;
        }

        public async Task JoinGroupAsync(string groupName, string userId)
        {
            /*
             * Add user to group
             */

            var group = await GetGroupAsync(groupName);
            if (group == null)
                throw new Exception($"Group '{groupName}' not found");

            await AddMemberToGroupAsync(group.GroupId, userId);

            Debug.WriteLine($"[GROUP MANAGER]: User {userId} joined group '{groupName}'");
        }

        private async Task AddMemberToGroupAsync(string groupId, string userId, string role = "member")
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var insert = @"
                INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at, role)
                VALUES (@groupId, @userId, @joinedAt, @role)
            ";

            using var command = new SqliteCommand(insert, connection);
            command.Parameters.AddWithValue("@groupId", groupId);
            command.Parameters.AddWithValue("@userId", userId);
            command.Parameters.AddWithValue("@joinedAt", DateTime.Now.ToString("O"));
            command.Parameters.AddWithValue("@role", role);

            await command.ExecuteNonQueryAsync();

            // Invalidate cache
            if (_groupsCache.ContainsKey(groupId))
                _groupsCache.Remove(groupId);
        }

        private async Task<List<string>> GetGroupMemberIdsAsync(string groupId)
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT user_id FROM group_members WHERE group_id = @groupId";
            using var command = new SqliteCommand(query, connection);
            command.Parameters.AddWithValue("@groupId", groupId);

            var members = new List<string>();

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                members.Add(reader.GetString(0));
            }

            return members;
        }

        public async Task<List<WorkspaceUser>> GetGroupMembersAsync(string groupId)
        {
            /*
             * Get full member info for a group
             */

            if (string.IsNullOrEmpty(groupId))
                return new List<WorkspaceUser>();

            var memberIds = await GetGroupMemberIdsAsync(groupId);

            // TODO: Load full user profiles
            // For now, return basic info

            return memberIds.Select(id => new WorkspaceUser
            {
                UserId = id,
                DisplayName = $"User {id.Substring(0, 8)}"
            }).ToList();
        }

        #endregion

        #region Storage Tracking

        public async Task UpdateGroupStorageAsync(string groupId, long bytesAdded)
        {
            /*
             * Update storage used by group
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var update = @"
                UPDATE groups
                SET storage_used = storage_used + @bytes
                WHERE group_id = @groupId
            ";

            using var command = new SqliteCommand(update, connection);
            command.Parameters.AddWithValue("@bytes", bytesAdded);
            command.Parameters.AddWithValue("@groupId", groupId);

            await command.ExecuteNonQueryAsync();

            // Invalidate cache
            if (_groupsCache.ContainsKey(groupId))
                _groupsCache.Remove(groupId);
        }

        public async Task<bool> CheckStorageQuotaAsync(string groupId, long bytesNeeded)
        {
            /*
             * Check if group has enough storage quota
             */

            var group = await GetGroupAsync(null);  // Load by ID instead

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            await connection.OpenAsync();

            var query = "SELECT storage_used, storage_limit FROM groups WHERE group_id = @groupId";
            using var command = new SqliteCommand(query, connection);
            command.Parameters.AddWithValue("@groupId", groupId);

            using var reader = await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return false;

            var used = reader.GetInt64(0);
            var limit = reader.GetInt64(1);

            return (used + bytesNeeded) <= limit;
        }

        #endregion

        #region Helpers

        private void LoadGroupsCache()
        {
            /*
             * Load frequently accessed groups into memory
             */

            using var connection = new SqliteConnection($"Data Source={_dbPath};Version=3;");
            connection.Open();

            var query = "SELECT * FROM groups LIMIT 100";
            using var command = new SqliteCommand(query, connection);
            using var reader = command.ExecuteReader();

            while (reader.Read())
            {
                var group = new WorkspaceGroup
                {
                    GroupId = reader.GetString(0),
                    GroupName = reader.GetString(1),
                    Description = reader.GetString(2),
                    OwnerId = reader.GetString(3),
                    Created = DateTime.Parse(reader.GetString(4)),
                    StorageUsedBytes = reader.GetInt64(5),
                    StorageLimitBytes = reader.GetInt64(6)
                };

                _groupsCache[group.GroupId] = group;
            }

            Debug.WriteLine($"[GROUP MANAGER]: Loaded {_groupsCache.Count} groups into cache");
        }

        #endregion
    }
}
