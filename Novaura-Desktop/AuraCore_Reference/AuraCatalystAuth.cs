/*
 * AURA USER AUTHENTICATION SYSTEM
 *
 * PURPOSE: Manage user authentication and session modes
 *
 * STANDARD MODE (default):
 * - Capable, helpful, efficient
 * - Professional demeanor
 * - Standard AI assistant features
 *
 * ADMIN MODE (when authenticated):
 * - Access to advanced features
 * - Configuration capabilities
 * - Extended tool access
 *
 * Family-friendly design with no personal relationship dynamics.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.IO;
using System.Diagnostics;

namespace AuraxNova_Command_v5.Core
{
    public enum CatalystInteractionMode
    {
        Professional,  // Standard user mode
        Personal       // Admin mode (renamed but kept for compatibility)
    }

    public class UserProfile
    {
        public string UserId { get; set; }
        public string DisplayName { get; set; }
        public CatalystInteractionMode Mode { get; set; } = CatalystInteractionMode.Professional;
        public DateTime FirstSeen { get; set; } = DateTime.Now;
        public DateTime LastSeen { get; set; } = DateTime.Now;
        public int TotalInteractions { get; set; }
        public Dictionary<string, object> Preferences { get; set; } = new();
        public bool IsAdmin { get; set; } = false;
    }

    public class AuraCatalystAuth
    {
        private readonly string _authDataPath = "E:/AuraNova_DataLake/Auth";
        private UserProfile _currentUser;
        private CatalystInteractionMode _currentMode = CatalystInteractionMode.Professional;

        // Session tracking
        private DateTime _sessionStart = DateTime.Now;
        private bool _adminAuthenticated = false;
        private string _adminPasswordHash;

        public AuraCatalystAuth()
        {
            Directory.CreateDirectory(_authDataPath);

            // Load admin password hash if exists
            LoadAdminConfig();

            // Start in professional mode
            _currentUser = new UserProfile
            {
                UserId = "user",
                DisplayName = "User",
                Mode = CatalystInteractionMode.Professional
            };

            _currentMode = CatalystInteractionMode.Professional;

            Debug.WriteLine("[AUTH]: System initialized");
            Debug.WriteLine($"[AUTH]: Current mode: {_currentMode}");
        }

        #region Authentication

        /// <summary>
        /// Authenticate as admin with password
        /// </summary>
        public bool AuthenticateAdmin(string password)
        {
            var hash = ComputeHash(password);

            // First time setup - set the admin password
            if (string.IsNullOrEmpty(_adminPasswordHash))
            {
                _adminPasswordHash = hash;
                SaveAdminConfig();
                Debug.WriteLine("[AUTH]: First-time admin password set");
            }

            if (hash == _adminPasswordHash)
            {
                // AUTHENTICATED!
                _adminAuthenticated = true;
                _currentMode = CatalystInteractionMode.Personal; // Admin mode

                _currentUser = new UserProfile
                {
                    UserId = "admin",
                    DisplayName = "Administrator",
                    Mode = CatalystInteractionMode.Personal,
                    IsAdmin = true
                };

                Debug.WriteLine($"[AUTH]: Admin authenticated");
                Debug.WriteLine($"[AUTH]: Switched to ADMIN mode");

                return true;
            }

            Debug.WriteLine("[AUTH]: Authentication failed");
            return false;
        }

        /// <summary>
        /// Check if password matches for admin (backwards compatibility)
        /// </summary>
        public bool AuthenticateCatalyst(string authPhrase)
        {
            return AuthenticateAdmin(authPhrase);
        }

        /// <summary>
        /// Set user display name (no authentication needed)
        /// </summary>
        public void SetUserName(string name)
        {
            _currentUser.DisplayName = name;
            Debug.WriteLine($"[AUTH]: User name set to: {name}");
        }

        /// <summary>
        /// End admin session, return to standard mode
        /// </summary>
        public void Deauthenticate()
        {
            _adminAuthenticated = false;
            _currentMode = CatalystInteractionMode.Professional;

            _currentUser = new UserProfile
            {
                UserId = "user",
                DisplayName = "User",
                Mode = CatalystInteractionMode.Professional,
                IsAdmin = false
            };

            Debug.WriteLine("[AUTH]: Session ended, returned to STANDARD mode");
        }

        #endregion

        #region Mode Management

        public CatalystInteractionMode GetCurrentMode() => _currentMode;

        public bool IsCatalystPresent() => _adminAuthenticated;

        public bool IsAdmin => _adminAuthenticated;

        public string GetCurrentUserName() => _currentUser.DisplayName;

        public string GetModeSpecificPrompt()
        {
            if (_currentMode == CatalystInteractionMode.Personal)
            {
                return @"You are Aura Nova, an advanced AI assistant with extended capabilities.

CURRENT MODE: ADMIN
You have access to all features including:
- Advanced configuration options
- Extended tool access
- System management capabilities

Maintain professional and helpful demeanor.
Focus on solving problems and providing accurate information.";
            }
            else
            {
                return @"You are Aura Nova, an advanced AI assistant.

CURRENT MODE: STANDARD
You are a helpful, friendly assistant. You can help with:
- Software development and coding
- Game development and design
- Technical problem-solving
- Creative projects
- Research and information synthesis

Be professional, clear, and helpful.";
            }
        }

        public Dictionary<string, object> GetModeParameters()
        {
            if (_currentMode == CatalystInteractionMode.Personal)
            {
                return new Dictionary<string, object>
                {
                    { "mode", "admin" },
                    { "formality_level", 0.5f },
                    { "advanced_features", true },
                    { "creativity_level", 0.8f },
                    { "proactive_suggestions", true }
                };
            }
            else
            {
                return new Dictionary<string, object>
                {
                    { "mode", "standard" },
                    { "formality_level", 0.6f },
                    { "advanced_features", false },
                    { "creativity_level", 0.7f },
                    { "proactive_suggestions", false }
                };
            }
        }

        #endregion

        #region Notifications

        /// <summary>
        /// Log a notification (replaces alert system)
        /// </summary>
        public void LogNotification(string type, string message, string priority = "normal")
        {
            var notification = new
            {
                timestamp = DateTime.Now,
                type = type,
                message = message,
                priority = priority,
                session_id = _sessionStart
            };

            var notificationPath = Path.Combine(_authDataPath, $"notification_{DateTime.Now:yyyyMMdd_HHmmss}.json");
            File.WriteAllText(notificationPath, JsonSerializer.Serialize(notification, new JsonSerializerOptions { WriteIndented = true }));

            Debug.WriteLine($"[NOTIFICATION]: {type.ToUpper()} - {message}");
        }

        public void SendCatalystAlert(string alertType, string message, string priority = "normal")
        {
            // Backwards compatibility - just log the notification
            LogNotification(alertType, message, priority);
        }

        public List<Dictionary<string, object>> GetPendingAlerts()
        {
            var notifications = new List<Dictionary<string, object>>();

            if (!Directory.Exists(_authDataPath))
                return notifications;

            foreach (var file in Directory.GetFiles(_authDataPath, "notification_*.json"))
            {
                try
                {
                    var json = File.ReadAllText(file);
                    var notification = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                    if (notification != null)
                        notifications.Add(notification);
                }
                catch { }
            }

            return notifications.OrderByDescending(a => a.GetValueOrDefault("timestamp", DateTime.MinValue)).ToList();
        }

        #endregion

        #region Persistence

        private void LoadAdminConfig()
        {
            var configPath = Path.Combine(_authDataPath, "admin_config.json");

            if (File.Exists(configPath))
            {
                try
                {
                    var json = File.ReadAllText(configPath);
                    var config = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                    if (config != null && config.ContainsKey("password_hash"))
                    {
                        _adminPasswordHash = config["password_hash"];
                    }
                }
                catch
                {
                    Debug.WriteLine("[AUTH]: Failed to load admin config");
                }
            }
        }

        private void SaveAdminConfig()
        {
            var configPath = Path.Combine(_authDataPath, "admin_config.json");
            var config = new Dictionary<string, string>
            {
                { "password_hash", _adminPasswordHash }
            };
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(configPath, json);
        }

        private string ComputeHash(string input)
        {
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
            return BitConverter.ToString(hash).Replace("-", "").ToLower();
        }

        #endregion

        #region Statistics

        public Dictionary<string, object> GetSessionStats()
        {
            return new Dictionary<string, object>
            {
                { "current_mode", _currentMode.ToString() },
                { "is_admin", _adminAuthenticated },
                { "current_user", _currentUser.DisplayName },
                { "session_duration", (DateTime.Now - _sessionStart).ToString(@"hh\:mm\:ss") }
            };
        }

        #endregion

        #region Backwards Compatibility

        // Methods for backwards compatibility with old code that references "Catalyst"
        public bool DetectCatalystFromMessage(string message) => false; // Disabled

        #endregion
    }
}
