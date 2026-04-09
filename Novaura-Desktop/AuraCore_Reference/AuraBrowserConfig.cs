/*
 * AURA BROWSER CONFIGURATION
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Manage browser settings for the embedded WebView2 browser
 * - Home page configuration
 * - Bookmarks
 * - Browser history
 * - Privacy settings
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    public class BrowserBookmark
    {
        public string Title { get; set; } = "";
        public string Url { get; set; } = "";
        public string Category { get; set; } = "General";
        public DateTime AddedAt { get; set; } = DateTime.Now;
        public int VisitCount { get; set; } = 0;
    }

    public class BrowserHistoryEntry
    {
        public string Title { get; set; } = "";
        public string Url { get; set; } = "";
        public DateTime VisitedAt { get; set; }
        public TimeSpan TimeSpent { get; set; }
    }

    public class AuraBrowserConfig
    {
        private readonly string _configPath = "E:/AuraNova_DataLake/Config/browser_config.json";
        private BrowserSettings _settings;

        // =========================================================================
        // DEFAULT SETTINGS - AuraxNova OS is the home!
        // =========================================================================

        public static class Defaults
        {
            public const string HomePage = "https://auraxnovaos.web.app/os/";
            public const string SearchEngine = "https://www.google.com/search?q=";
            public const bool SaveHistory = true;
            public const int MaxHistoryEntries = 1000;
        }

        public AuraBrowserConfig()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_configPath)!);
            LoadSettings();
        }

        // =========================================================================
        // SETTINGS CLASS
        // =========================================================================

        public class BrowserSettings
        {
            // Home page - AuraxNova OS web app
            public string HomePage { get; set; } = Defaults.HomePage;

            // Search engine
            public string SearchEngineUrl { get; set; } = Defaults.SearchEngine;

            // History settings
            public bool SaveBrowsingHistory { get; set; } = Defaults.SaveHistory;
            public int MaxHistoryEntries { get; set; } = Defaults.MaxHistoryEntries;

            // Privacy
            public bool ClearHistoryOnExit { get; set; } = false;
            public bool BlockThirdPartyCookies { get; set; } = true;

            // UI
            public bool ShowBookmarksBar { get; set; } = true;
            public double DefaultZoomLevel { get; set; } = 1.0;

            // Aura-specific
            public bool AllowAuraToNavigate { get; set; } = true;
            public bool AllowAuraToSearch { get; set; } = true;
            public bool NotifyOnNavigation { get; set; } = true;

            // Quick access bookmarks
            public List<BrowserBookmark> Bookmarks { get; set; } = new()
            {
                new BrowserBookmark
                {
                    Title = "AuraxNova OS",
                    Url = "https://auraxnovaos.web.app/os/",
                    Category = "Home"
                },
                new BrowserBookmark
                {
                    Title = "AuraxNova Studio",
                    Url = "https://auraxnovaos.web.app/studio/",
                    Category = "Tools"
                },
                new BrowserBookmark
                {
                    Title = "GitHub",
                    Url = "https://github.com",
                    Category = "Development"
                },
                new BrowserBookmark
                {
                    Title = "Stack Overflow",
                    Url = "https://stackoverflow.com",
                    Category = "Development"
                }
            };

            // History (in-memory, persisted separately)
            public List<BrowserHistoryEntry> RecentHistory { get; set; } = new();
        }

        // =========================================================================
        // ACCESSORS
        // =========================================================================

        public string HomePage => _settings.HomePage;
        public string SearchEngineUrl => _settings.SearchEngineUrl;
        public bool SaveBrowsingHistory => _settings.SaveBrowsingHistory;
        public List<BrowserBookmark> Bookmarks => _settings.Bookmarks;
        public BrowserSettings Settings => _settings;

        // =========================================================================
        // METHODS
        // =========================================================================

        /// <summary>
        /// Get the URL to navigate to on browser startup
        /// </summary>
        public string GetStartupUrl()
        {
            return _settings.HomePage;
        }

        /// <summary>
        /// Add a bookmark
        /// </summary>
        public void AddBookmark(string title, string url, string category = "General")
        {
            _settings.Bookmarks.Add(new BrowserBookmark
            {
                Title = title,
                Url = url,
                Category = category,
                AddedAt = DateTime.Now
            });
            SaveSettings();
        }

        /// <summary>
        /// Remove a bookmark
        /// </summary>
        public void RemoveBookmark(string url)
        {
            _settings.Bookmarks.RemoveAll(b => b.Url == url);
            SaveSettings();
        }

        /// <summary>
        /// Record a page visit
        /// </summary>
        public void RecordVisit(string title, string url)
        {
            if (!_settings.SaveBrowsingHistory) return;

            _settings.RecentHistory.Insert(0, new BrowserHistoryEntry
            {
                Title = title,
                Url = url,
                VisitedAt = DateTime.Now
            });

            // Trim history
            if (_settings.RecentHistory.Count > _settings.MaxHistoryEntries)
            {
                _settings.RecentHistory.RemoveRange(
                    _settings.MaxHistoryEntries,
                    _settings.RecentHistory.Count - _settings.MaxHistoryEntries
                );
            }

            // Update bookmark visit count
            var bookmark = _settings.Bookmarks.Find(b => b.Url == url);
            if (bookmark != null)
            {
                bookmark.VisitCount++;
            }

            SaveSettings();
        }

        /// <summary>
        /// Get search URL for a query
        /// </summary>
        public string GetSearchUrl(string query)
        {
            return _settings.SearchEngineUrl + Uri.EscapeDataString(query);
        }

        /// <summary>
        /// Set home page
        /// </summary>
        public void SetHomePage(string url)
        {
            _settings.HomePage = url;
            SaveSettings();
            Console.WriteLine($"[BROWSER CONFIG]: Home page set to {url}");
        }

        /// <summary>
        /// Reset to default home page (AuraxNova OS)
        /// </summary>
        public void ResetToDefaultHomePage()
        {
            _settings.HomePage = Defaults.HomePage;
            SaveSettings();
            Console.WriteLine("[BROWSER CONFIG]: Home page reset to AuraxNova OS");
        }

        /// <summary>
        /// Clear browsing history
        /// </summary>
        public void ClearHistory()
        {
            _settings.RecentHistory.Clear();
            SaveSettings();
            Console.WriteLine("[BROWSER CONFIG]: History cleared");
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadSettings()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var json = File.ReadAllText(_configPath);
                    _settings = JsonSerializer.Deserialize<BrowserSettings>(json) ?? new BrowserSettings();
                    Console.WriteLine($"[BROWSER CONFIG]: Loaded settings. Home: {_settings.HomePage}");
                }
                else
                {
                    _settings = new BrowserSettings();
                    SaveSettings();  // Create default config
                    Console.WriteLine("[BROWSER CONFIG]: Created default settings");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BROWSER CONFIG ERROR]: {ex.Message}");
                _settings = new BrowserSettings();
            }
        }

        private void SaveSettings()
        {
            try
            {
                var json = JsonSerializer.Serialize(_settings, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_configPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BROWSER CONFIG ERROR]: Failed to save: {ex.Message}");
            }
        }

        // =========================================================================
        // QUICK ACCESS
        // =========================================================================

        /// <summary>
        /// Get bookmarks by category
        /// </summary>
        public List<BrowserBookmark> GetBookmarksByCategory(string category)
        {
            return _settings.Bookmarks.FindAll(b => b.Category == category);
        }

        /// <summary>
        /// Get most visited bookmarks
        /// </summary>
        public List<BrowserBookmark> GetMostVisited(int count = 5)
        {
            return _settings.Bookmarks
                .OrderByDescending(b => b.VisitCount)
                .Take(count)
                .ToList();
        }

        /// <summary>
        /// Get recent history
        /// </summary>
        public List<BrowserHistoryEntry> GetRecentHistory(int count = 10)
        {
            return _settings.RecentHistory.Take(count).ToList();
        }
    }
}
