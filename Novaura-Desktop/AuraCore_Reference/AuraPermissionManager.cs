/*
 * AURA PERMISSION MANAGER
 *
 * Manages user consent for sensitive device and AGENTIC access:
 * - Camera/Webcam access
 * - Microphone/Audio access
 * - Screen capture
 * - File system access
 * - AGENTIC: Terminal/CMD execution
 * - AGENTIC: Code editor access
 * - AGENTIC: Script execution
 * - AGENTIC: Process management
 *
 * Aura is an AGENTIC AI - she can take actions on behalf of the user.
 * All sensitive features require explicit user permission via toggle or dialog.
 * Permissions are persisted and can be revoked at any time.
 *
 * PHILOSOPHY: Aura always asks before using new capabilities.
 * She has permanent access to her own memories - that's not a permission.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    public enum PermissionType
    {
        // Device Access
        Camera,
        Microphone,
        ScreenCapture,
        FileSystemRead,
        FileSystemWrite,
        NetworkAccess,
        LocationAccess,

        // AGENTIC Permissions - Aura can take actions
        TerminalExecution,      // Open CMD, PowerShell, execute commands
        CodeEditorAccess,       // Open VS Code, Visual Studio, etc.
        ScriptExecution,        // Create and run scripts (.ps1, .bat, .py)
        ProcessManagement,      // Start/stop processes
        SystemConfiguration,    // Modify system settings
        BrowserAutomation       // Control web browser
    }

    public enum PermissionStatus
    {
        NotRequested,
        Granted,
        Denied,
        Revoked
    }

    public class PermissionRecord
    {
        public PermissionType Type { get; set; }
        public PermissionStatus Status { get; set; }
        public DateTime? GrantedAt { get; set; }
        public DateTime? LastUsed { get; set; }
        public string GrantedReason { get; set; }
        public int UsageCount { get; set; }
    }

    public class AuraPermissionManager
    {
        private readonly string _permissionsPath = "E:/AuraNova_DataLake/Config/permissions.json";
        private Dictionary<PermissionType, PermissionRecord> _permissions = new();

        // Events for UI notifications
        public event Action<PermissionType, bool>? OnPermissionChanged;
        public event Func<PermissionType, string, bool>? OnPermissionRequested;

        public AuraPermissionManager()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_permissionsPath));
            LoadPermissions();
        }

        // =========================================================================
        // PERMISSION CHECKING
        // =========================================================================

        /// <summary>
        /// Check if permission is currently granted
        /// </summary>
        public bool HasPermission(PermissionType type)
        {
            if (_permissions.TryGetValue(type, out var record))
            {
                return record.Status == PermissionStatus.Granted;
            }
            return false;
        }

        /// <summary>
        /// Get current status of a permission
        /// </summary>
        public PermissionStatus GetPermissionStatus(PermissionType type)
        {
            if (_permissions.TryGetValue(type, out var record))
            {
                return record.Status;
            }
            return PermissionStatus.NotRequested;
        }

        // =========================================================================
        // PERMISSION REQUESTS
        // =========================================================================

        /// <summary>
        /// Request permission from user with a reason
        /// Returns true if permission was granted
        /// </summary>
        public bool RequestPermission(PermissionType type, string reason)
        {
            Console.WriteLine($"[PERMISSIONS]: Requesting {type} permission: {reason}");

            // Check if already granted
            if (HasPermission(type))
            {
                Console.WriteLine($"[PERMISSIONS]: {type} already granted");
                RecordUsage(type);
                return true;
            }

            // Request from user via event (UI will handle the dialog)
            if (OnPermissionRequested != null)
            {
                bool granted = OnPermissionRequested.Invoke(type, reason);

                if (granted)
                {
                    GrantPermission(type, reason);
                }
                else
                {
                    DenyPermission(type);
                }

                return granted;
            }

            // No handler - permission denied by default
            Console.WriteLine($"[PERMISSIONS]: {type} permission request has no handler - denied");
            return false;
        }

        /// <summary>
        /// Check permission and request if not granted
        /// This is the primary method features should call
        /// </summary>
        public bool EnsurePermission(PermissionType type, string reason)
        {
            if (HasPermission(type))
            {
                RecordUsage(type);
                return true;
            }

            return RequestPermission(type, reason);
        }

        // =========================================================================
        // PERMISSION MANAGEMENT (UI Controls)
        // =========================================================================

        /// <summary>
        /// Grant permission (called from UI toggle)
        /// </summary>
        public void GrantPermission(PermissionType type, string reason = null)
        {
            if (!_permissions.ContainsKey(type))
            {
                _permissions[type] = new PermissionRecord { Type = type };
            }

            var record = _permissions[type];
            record.Status = PermissionStatus.Granted;
            record.GrantedAt = DateTime.Now;
            record.GrantedReason = reason ?? "User granted via settings";

            SavePermissions();
            OnPermissionChanged?.Invoke(type, true);

            Console.WriteLine($"[PERMISSIONS]: {type} GRANTED - {reason}");
        }

        /// <summary>
        /// Deny permission (called from UI toggle or request dialog)
        /// </summary>
        public void DenyPermission(PermissionType type)
        {
            if (!_permissions.ContainsKey(type))
            {
                _permissions[type] = new PermissionRecord { Type = type };
            }

            _permissions[type].Status = PermissionStatus.Denied;

            SavePermissions();
            OnPermissionChanged?.Invoke(type, false);

            Console.WriteLine($"[PERMISSIONS]: {type} DENIED");
        }

        /// <summary>
        /// Revoke previously granted permission
        /// </summary>
        public void RevokePermission(PermissionType type)
        {
            if (_permissions.TryGetValue(type, out var record))
            {
                record.Status = PermissionStatus.Revoked;
                SavePermissions();
                OnPermissionChanged?.Invoke(type, false);

                Console.WriteLine($"[PERMISSIONS]: {type} REVOKED");
            }
        }

        /// <summary>
        /// Toggle permission on/off (for UI toggle switches)
        /// </summary>
        public bool TogglePermission(PermissionType type, string reason = null)
        {
            if (HasPermission(type))
            {
                RevokePermission(type);
                return false;
            }
            else
            {
                GrantPermission(type, reason);
                return true;
            }
        }

        // =========================================================================
        // USAGE TRACKING
        // =========================================================================

        private void RecordUsage(PermissionType type)
        {
            if (_permissions.TryGetValue(type, out var record))
            {
                record.LastUsed = DateTime.Now;
                record.UsageCount++;
                SavePermissions();
            }
        }

        // =========================================================================
        // PERMISSION SUMMARY
        // =========================================================================

        /// <summary>
        /// Get all permission statuses (for Settings UI)
        /// </summary>
        public Dictionary<PermissionType, PermissionRecord> GetAllPermissions()
        {
            // Ensure all permission types have records
            foreach (PermissionType type in Enum.GetValues(typeof(PermissionType)))
            {
                if (!_permissions.ContainsKey(type))
                {
                    _permissions[type] = new PermissionRecord
                    {
                        Type = type,
                        Status = PermissionStatus.NotRequested
                    };
                }
            }

            return new Dictionary<PermissionType, PermissionRecord>(_permissions);
        }

        /// <summary>
        /// Get human-readable description for a permission
        /// </summary>
        public static string GetPermissionDescription(PermissionType type)
        {
            return type switch
            {
                // Device Access
                PermissionType.Camera => "Access your camera for visual features like video calls and image capture",
                PermissionType.Microphone => "Access your microphone for voice commands and speech-to-text",
                PermissionType.ScreenCapture => "Capture your screen for sharing and assistance features",
                PermissionType.FileSystemRead => "Read files from your computer to help with your work",
                PermissionType.FileSystemWrite => "Save files to your computer",
                PermissionType.NetworkAccess => "Access the internet for web searches and API calls",
                PermissionType.LocationAccess => "Access your location for location-based features",

                // AGENTIC Permissions
                PermissionType.TerminalExecution => "Open terminals (CMD, PowerShell) and execute commands on your behalf",
                PermissionType.CodeEditorAccess => "Open code editors (VS Code, Visual Studio) to help with development",
                PermissionType.ScriptExecution => "Create and run scripts (PowerShell, Batch, Python) to automate tasks",
                PermissionType.ProcessManagement => "Start and manage system processes",
                PermissionType.SystemConfiguration => "Modify system settings and configuration",
                PermissionType.BrowserAutomation => "Control web browser for research and automation",

                _ => "Unknown permission"
            };
        }

        /// <summary>
        /// Get friendly name for a permission
        /// </summary>
        public static string GetPermissionName(PermissionType type)
        {
            return type switch
            {
                // Device Access
                PermissionType.Camera => "Camera Access",
                PermissionType.Microphone => "Microphone Access",
                PermissionType.ScreenCapture => "Screen Capture",
                PermissionType.FileSystemRead => "Read Files",
                PermissionType.FileSystemWrite => "Write Files",
                PermissionType.NetworkAccess => "Internet Access",
                PermissionType.LocationAccess => "Location Access",

                // AGENTIC Permissions
                PermissionType.TerminalExecution => "Terminal & Commands",
                PermissionType.CodeEditorAccess => "Code Editors",
                PermissionType.ScriptExecution => "Script Execution",
                PermissionType.ProcessManagement => "Process Control",
                PermissionType.SystemConfiguration => "System Settings",
                PermissionType.BrowserAutomation => "Browser Automation",

                _ => type.ToString()
            };
        }

        /// <summary>
        /// Check if a permission is an agentic (action-taking) permission
        /// </summary>
        public static bool IsAgenticPermission(PermissionType type)
        {
            return type switch
            {
                PermissionType.TerminalExecution => true,
                PermissionType.CodeEditorAccess => true,
                PermissionType.ScriptExecution => true,
                PermissionType.ProcessManagement => true,
                PermissionType.SystemConfiguration => true,
                PermissionType.BrowserAutomation => true,
                _ => false
            };
        }

        /// <summary>
        /// Get warning text for agentic permissions
        /// </summary>
        public static string GetAgenticWarning(PermissionType type)
        {
            if (!IsAgenticPermission(type))
                return "";

            return type switch
            {
                PermissionType.TerminalExecution =>
                    "This allows Aura to execute commands on your system. She will always show you what she's about to run.",
                PermissionType.CodeEditorAccess =>
                    "This allows Aura to open and interact with code editors to help you develop.",
                PermissionType.ScriptExecution =>
                    "This allows Aura to create and run scripts. Scripts will be shown to you before execution.",
                PermissionType.ProcessManagement =>
                    "This allows Aura to start and manage system processes.",
                PermissionType.SystemConfiguration =>
                    "This is a powerful permission. Aura can modify system settings. Use with caution.",
                PermissionType.BrowserAutomation =>
                    "This allows Aura to control a web browser for research and automation tasks.",
                _ => "This is an agentic permission that allows Aura to take actions on your behalf."
            };
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadPermissions()
        {
            try
            {
                if (File.Exists(_permissionsPath))
                {
                    var json = File.ReadAllText(_permissionsPath);
                    var loaded = JsonSerializer.Deserialize<Dictionary<string, PermissionRecord>>(json);

                    if (loaded != null)
                    {
                        _permissions.Clear();
                        foreach (var kvp in loaded)
                        {
                            if (Enum.TryParse<PermissionType>(kvp.Key, out var type))
                            {
                                _permissions[type] = kvp.Value;
                            }
                        }
                    }

                    Console.WriteLine($"[PERMISSIONS]: Loaded {_permissions.Count} permission records");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PERMISSIONS]: Failed to load permissions: {ex.Message}");
            }
        }

        private void SavePermissions()
        {
            try
            {
                var toSave = new Dictionary<string, PermissionRecord>();
                foreach (var kvp in _permissions)
                {
                    toSave[kvp.Key.ToString()] = kvp.Value;
                }

                var json = JsonSerializer.Serialize(toSave, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_permissionsPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PERMISSIONS]: Failed to save permissions: {ex.Message}");
            }
        }

        // =========================================================================
        // CONVENIENCE METHODS FOR COMMON PERMISSIONS
        // =========================================================================

        public bool CanUseCamera => HasPermission(PermissionType.Camera);
        public bool CanUseMicrophone => HasPermission(PermissionType.Microphone);
        public bool CanCaptureScreen => HasPermission(PermissionType.ScreenCapture);

        /// <summary>
        /// Request camera access with standard reason
        /// </summary>
        public bool RequestCameraAccess(string customReason = null)
        {
            return EnsurePermission(PermissionType.Camera,
                customReason ?? "Enable camera for visual features and video communication");
        }

        /// <summary>
        /// Request microphone access with standard reason
        /// </summary>
        public bool RequestMicrophoneAccess(string customReason = null)
        {
            return EnsurePermission(PermissionType.Microphone,
                customReason ?? "Enable microphone for voice commands and speech recognition");
        }

        /// <summary>
        /// Request screen capture access with standard reason
        /// </summary>
        public bool RequestScreenCaptureAccess(string customReason = null)
        {
            return EnsurePermission(PermissionType.ScreenCapture,
                customReason ?? "Enable screen capture to help with your work");
        }

        // =========================================================================
        // AGENTIC PERMISSION CONVENIENCE METHODS
        // =========================================================================

        public bool CanExecuteTerminal => HasPermission(PermissionType.TerminalExecution);
        public bool CanOpenCodeEditors => HasPermission(PermissionType.CodeEditorAccess);
        public bool CanExecuteScripts => HasPermission(PermissionType.ScriptExecution);
        public bool CanManageProcesses => HasPermission(PermissionType.ProcessManagement);

        /// <summary>
        /// Request terminal execution permission
        /// </summary>
        public bool RequestTerminalAccess(string customReason = null)
        {
            return EnsurePermission(PermissionType.TerminalExecution,
                customReason ?? "Allow Aura to open terminals and execute commands to help with development tasks");
        }

        /// <summary>
        /// Request code editor access permission
        /// </summary>
        public bool RequestCodeEditorAccess(string customReason = null)
        {
            return EnsurePermission(PermissionType.CodeEditorAccess,
                customReason ?? "Allow Aura to open code editors like VS Code to assist with programming");
        }

        /// <summary>
        /// Request script execution permission
        /// </summary>
        public bool RequestScriptExecutionAccess(string customReason = null)
        {
            return EnsurePermission(PermissionType.ScriptExecution,
                customReason ?? "Allow Aura to create and run automation scripts (PowerShell, Batch, Python)");
        }

        /// <summary>
        /// Request all agentic permissions at once (for power users)
        /// </summary>
        public bool RequestFullAgenticAccess(string reason = "Enable all agentic capabilities for Aura")
        {
            var allGranted = true;

            allGranted &= EnsurePermission(PermissionType.TerminalExecution, reason);
            allGranted &= EnsurePermission(PermissionType.CodeEditorAccess, reason);
            allGranted &= EnsurePermission(PermissionType.ScriptExecution, reason);
            allGranted &= EnsurePermission(PermissionType.FileSystemRead, reason);
            allGranted &= EnsurePermission(PermissionType.FileSystemWrite, reason);

            return allGranted;
        }

        /// <summary>
        /// Get all granted agentic permissions
        /// </summary>
        public List<PermissionType> GetGrantedAgenticPermissions()
        {
            var agentic = new List<PermissionType>();

            foreach (var kvp in _permissions)
            {
                if (IsAgenticPermission(kvp.Key) && kvp.Value.Status == PermissionStatus.Granted)
                {
                    agentic.Add(kvp.Key);
                }
            }

            return agentic;
        }

        /// <summary>
        /// Get summary of agentic capabilities
        /// </summary>
        public string GetAgenticCapabilitiesSummary()
        {
            var capabilities = new List<string>();

            if (CanExecuteTerminal)
                capabilities.Add("Execute terminal commands");
            if (CanOpenCodeEditors)
                capabilities.Add("Open code editors");
            if (CanExecuteScripts)
                capabilities.Add("Run scripts");
            if (CanManageProcesses)
                capabilities.Add("Manage processes");
            if (HasPermission(PermissionType.FileSystemRead))
                capabilities.Add("Read files");
            if (HasPermission(PermissionType.FileSystemWrite))
                capabilities.Add("Write files");

            if (capabilities.Count == 0)
                return "No agentic capabilities granted yet.";

            return "Aura can: " + string.Join(", ", capabilities);
        }
    }
}
