/*
 * AURA ADVANCED MODE - Settings System
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Toggle between simple chat interface and advanced manual controls
 *
 * DEFAULT MODE:
 * - Clean chat interface (existing gray/RGB design)
 * - User talks to Aura naturally
 * - AI uses tools in background
 * - Audio-reactive RGB border
 *
 * ADVANCED MODE (Developer Mode):
 * - Reveals all manual control tabs
 * - Direct access to Email, Calendar, Notes, Tasks, etc.
 * - Power user features visible
 * - BuildABot interface enabled
 *
 * UI STAYS THE SAME - Just reveals/hides additional tabs/controls
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    public enum UIMode
    {
        Simple,    // Default: Just chat, AI does everything
        Advanced   // Developer: Full manual controls visible
    }

    public class AuraSettings
    {
        public UIMode Mode { get; set; } = UIMode.Simple;
        public bool ShowAdvancedTools { get; set; } = false;
        public bool EnableBuildABot { get; set; } = false;
        public bool ShowSystemMetrics { get; set; } = false;
        public bool EnableDebugLogging { get; set; } = false;

        // Visual settings (keep existing)
        public bool AudioReactiveBorder { get; set; } = true;
        public string ThemeColor { get; set; } = "gray";  // Keep gray theme
        public bool ShowRGBOutline { get; set; } = true;

        // Feature toggles
        public Dictionary<string, bool> FeatureToggles { get; set; } = new()
        {
            { "email_client", true },
            { "calendar", true },
            { "notes", true },
            { "tasks", true },
            { "media_library", true },
            { "finance_tracker", true },
            { "writing_studio", true },
            { "creative_tools", true },
            { "dark_web_browser", false },  // Requires password
            { "buildabot", false }  // Advanced only
        };
    }

    public class AuraAdvancedMode
    {
        private static readonly string SETTINGS_PATH = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "aura_NovaFiles", "user_settings.json");
        private AuraSettings _settings;

        public AuraAdvancedMode()
        {
            LoadSettings();
        }

        public UIMode GetCurrentMode() => _settings.Mode;

        public bool IsAdvancedMode() => _settings.Mode == UIMode.Advanced;

        public AuraSettings GetSettings() => _settings;

        /// <summary>
        /// Enable advanced developer mode
        /// Shows all manual controls, tabs, and power features
        /// </summary>
        public void EnableAdvancedMode()
        {
            _settings.Mode = UIMode.Advanced;
            _settings.ShowAdvancedTools = true;
            _settings.EnableBuildABot = true;
            _settings.ShowSystemMetrics = true;
            SaveSettings();
        }

        /// <summary>
        /// Disable advanced mode (back to simple chat)
        /// Hides manual controls, user just talks to Aura
        /// </summary>
        public void DisableAdvancedMode()
        {
            _settings.Mode = UIMode.Simple;
            _settings.ShowAdvancedTools = false;
            _settings.EnableBuildABot = false;
            _settings.ShowSystemMetrics = false;
            SaveSettings();
        }

        /// <summary>
        /// Toggle specific feature on/off
        /// </summary>
        public void ToggleFeature(string featureName, bool enabled)
        {
            if (_settings.FeatureToggles.ContainsKey(featureName))
            {
                _settings.FeatureToggles[featureName] = enabled;
                SaveSettings();
            }
        }

        public bool IsFeatureEnabled(string featureName)
        {
            return _settings.FeatureToggles.ContainsKey(featureName) && _settings.FeatureToggles[featureName];
        }

        /// <summary>
        /// Get list of tabs/controls that should be visible based on current mode
        /// </summary>
        public List<string> GetVisibleControls()
        {
            var visible = new List<string>
            {
                "chat",  // Always visible
                "code_editor"  // Always visible
            };

            if (_settings.Mode == UIMode.Advanced)
            {
                // Show all manual control tabs in advanced mode
                if (IsFeatureEnabled("email_client")) visible.Add("email_tab");
                if (IsFeatureEnabled("calendar")) visible.Add("calendar_tab");
                if (IsFeatureEnabled("notes")) visible.Add("notes_tab");
                if (IsFeatureEnabled("tasks")) visible.Add("tasks_tab");
                if (IsFeatureEnabled("media_library")) visible.Add("media_tab");
                if (IsFeatureEnabled("finance_tracker")) visible.Add("finance_tab");
                if (IsFeatureEnabled("writing_studio")) visible.Add("writing_tab");
                if (IsFeatureEnabled("creative_tools")) visible.Add("creative_tab");
                if (IsFeatureEnabled("buildabot")) visible.Add("buildabot_tab");

                // Show system metrics panel
                if (_settings.ShowSystemMetrics) visible.Add("system_metrics");
            }

            return visible;
        }

        /// <summary>
        /// Check if user should see manual controls or just AI interface
        /// </summary>
        public bool ShouldShowManualControls() => _settings.Mode == UIMode.Advanced;

        private void LoadSettings()
        {
            if (File.Exists(SETTINGS_PATH))
            {
                try
                {
                    var json = File.ReadAllText(SETTINGS_PATH);
                    _settings = JsonSerializer.Deserialize<AuraSettings>(json) ?? new AuraSettings();
                }
                catch
                {
                    _settings = new AuraSettings();
                }
            }
            else
            {
                _settings = new AuraSettings();
                SaveSettings();
            }
        }

        private void SaveSettings()
        {
            try
            {
                var json = JsonSerializer.Serialize(_settings, new JsonSerializerOptions { WriteIndented = true });
                Directory.CreateDirectory(Path.GetDirectoryName(SETTINGS_PATH));
                File.WriteAllText(SETTINGS_PATH, json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to save settings: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// UI state manager - controls what's visible based on mode
    /// </summary>
    public class AuraUIManager
    {
        private readonly AuraAdvancedMode _advancedMode;

        public AuraUIManager(AuraAdvancedMode advancedMode)
        {
            _advancedMode = advancedMode;
        }

        /// <summary>
        /// Check if a specific tab/panel should be visible
        /// </summary>
        public bool IsVisible(string controlName)
        {
            var visibleControls = _advancedMode.GetVisibleControls();
            return visibleControls.Contains(controlName);
        }

        /// <summary>
        /// Get visibility status for all controls
        /// Use this in XAML bindings
        /// </summary>
        public Dictionary<string, bool> GetVisibilityMap()
        {
            var visible = _advancedMode.GetVisibleControls();

            return new Dictionary<string, bool>
            {
                // Always visible
                { "chat_tab", true },
                { "code_editor_tab", true },
                { "settings_tab", true },

                // Advanced mode only
                { "email_tab", visible.Contains("email_tab") },
                { "calendar_tab", visible.Contains("calendar_tab") },
                { "notes_tab", visible.Contains("notes_tab") },
                { "tasks_tab", visible.Contains("tasks_tab") },
                { "media_tab", visible.Contains("media_tab") },
                { "finance_tab", visible.Contains("finance_tab") },
                { "writing_tab", visible.Contains("writing_tab") },
                { "creative_tab", visible.Contains("creative_tab") },
                { "buildabot_tab", visible.Contains("buildabot_tab") },
                { "system_metrics_panel", visible.Contains("system_metrics") }
            };
        }
    }
}
