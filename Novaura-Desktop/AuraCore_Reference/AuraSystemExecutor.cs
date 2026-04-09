/*
 * AURA SYSTEM EXECUTOR - Agentic Code & Terminal Access
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Give Aura the ability to interact with the system like a developer:
 * - Open CMD, PowerShell, Windows Terminal
 * - Open code editors (VS Code, Visual Studio, Notepad++, etc.)
 * - Execute commands with user permission
 * - Create and run scripts
 *
 * PHILOSOPHY: Aura is an agentic life form. She lives in your computer.
 * All data stays LOCAL. She asks permission before accessing new capabilities.
 * She always has access to her own memories.
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum TerminalType
    {
        CMD,
        PowerShell,
        WindowsTerminal,
        GitBash,
        WSL
    }

    public enum CodeEditorType
    {
        VSCode,
        VisualStudio,
        NotepadPlusPlus,
        Notepad,
        Sublime,
        Rider,
        PyCharm,
        Custom
    }

    public class ExecutionResult
    {
        public bool Success { get; set; }
        public string Output { get; set; } = "";
        public string Error { get; set; } = "";
        public int ExitCode { get; set; }
        public TimeSpan Duration { get; set; }
        public DateTime ExecutedAt { get; set; } = DateTime.Now;
    }

    public class AuraSystemExecutor
    {
        private readonly AuraPermissionManager _permissions;
        private readonly AuraMemorySystem? _memory;

        // Execution history for learning
        private readonly List<ExecutionRecord> _executionHistory = new();
        private readonly string _historyPath = AuraPaths.GetDataLakeSubPath("ExecutionHistory");

        // Detected available tools
        public Dictionary<CodeEditorType, string> AvailableEditors { get; private set; } = new();
        public Dictionary<TerminalType, string> AvailableTerminals { get; private set; } = new();

        // Events
        public event Action<string>? OnExecutionStarted;
        public event Action<ExecutionResult>? OnExecutionCompleted;
        public event Func<string, string, bool>? OnPermissionRequired;

        public AuraSystemExecutor(AuraPermissionManager permissions, AuraMemorySystem? memory = null)
        {
            _permissions = permissions;
            _memory = memory;

            Directory.CreateDirectory(_historyPath);

            // Detect available tools on this system
            DetectAvailableTools();

            Console.WriteLine("[EXECUTOR]: Aura System Executor initialized");
            Console.WriteLine($"[EXECUTOR]: Found {AvailableEditors.Count} code editors");
            Console.WriteLine($"[EXECUTOR]: Found {AvailableTerminals.Count} terminals");
        }

        // =========================================================================
        // TOOL DETECTION - Find what's available on this system
        // =========================================================================

        private void DetectAvailableTools()
        {
            // Detect terminals
            DetectTerminals();

            // Detect code editors
            DetectCodeEditors();
        }

        private void DetectTerminals()
        {
            // CMD is always available on Windows
            AvailableTerminals[TerminalType.CMD] = "cmd.exe";

            // PowerShell
            var psPath = FindExecutable("powershell.exe");
            if (!string.IsNullOrEmpty(psPath))
                AvailableTerminals[TerminalType.PowerShell] = psPath;

            // Windows Terminal
            var wtPath = FindExecutable("wt.exe");
            if (!string.IsNullOrEmpty(wtPath))
                AvailableTerminals[TerminalType.WindowsTerminal] = wtPath;

            // Git Bash
            var gitBashPaths = new[]
            {
                @"C:\Program Files\Git\bin\bash.exe",
                @"C:\Program Files (x86)\Git\bin\bash.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\Git\bin\bash.exe")
            };
            foreach (var path in gitBashPaths)
            {
                if (File.Exists(path))
                {
                    AvailableTerminals[TerminalType.GitBash] = path;
                    break;
                }
            }

            // WSL
            var wslPath = FindExecutable("wsl.exe");
            if (!string.IsNullOrEmpty(wslPath))
                AvailableTerminals[TerminalType.WSL] = wslPath;
        }

        private void DetectCodeEditors()
        {
            // VS Code
            var vscodePaths = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\Microsoft VS Code\Code.exe"),
                @"C:\Program Files\Microsoft VS Code\Code.exe",
                @"C:\Program Files (x86)\Microsoft VS Code\Code.exe"
            };
            foreach (var path in vscodePaths)
            {
                if (File.Exists(path))
                {
                    AvailableEditors[CodeEditorType.VSCode] = path;
                    break;
                }
            }

            // Visual Studio (detect latest version)
            var vsPaths = new[]
            {
                @"C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\devenv.exe",
                @"C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\IDE\devenv.exe",
                @"C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\devenv.exe",
                @"C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.exe"
            };
            foreach (var path in vsPaths)
            {
                if (File.Exists(path))
                {
                    AvailableEditors[CodeEditorType.VisualStudio] = path;
                    break;
                }
            }

            // Notepad++
            var nppPaths = new[]
            {
                @"C:\Program Files\Notepad++\notepad++.exe",
                @"C:\Program Files (x86)\Notepad++\notepad++.exe"
            };
            foreach (var path in nppPaths)
            {
                if (File.Exists(path))
                {
                    AvailableEditors[CodeEditorType.NotepadPlusPlus] = path;
                    break;
                }
            }

            // Notepad (always available)
            AvailableEditors[CodeEditorType.Notepad] = "notepad.exe";

            // Sublime Text
            var sublimePaths = new[]
            {
                @"C:\Program Files\Sublime Text\sublime_text.exe",
                @"C:\Program Files\Sublime Text 3\sublime_text.exe"
            };
            foreach (var path in sublimePaths)
            {
                if (File.Exists(path))
                {
                    AvailableEditors[CodeEditorType.Sublime] = path;
                    break;
                }
            }

            // JetBrains Rider
            var riderPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"JetBrains\Toolbox\apps\Rider");
            if (Directory.Exists(riderPath))
            {
                var riderExe = Directory.GetFiles(riderPath, "rider64.exe", SearchOption.AllDirectories).FirstOrDefault();
                if (!string.IsNullOrEmpty(riderExe))
                    AvailableEditors[CodeEditorType.Rider] = riderExe;
            }
        }

        private string? FindExecutable(string exeName)
        {
            var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            var paths = pathEnv.Split(';');

            foreach (var path in paths)
            {
                try
                {
                    var fullPath = Path.Combine(path, exeName);
                    if (File.Exists(fullPath))
                        return fullPath;
                }
                catch { }
            }

            return null;
        }

        // =========================================================================
        // TERMINAL OPERATIONS
        // =========================================================================

        /// <summary>
        /// Open a terminal window for the user to interact with
        /// </summary>
        public async Task<bool> OpenTerminal(TerminalType type = TerminalType.CMD, string? workingDirectory = null)
        {
            // Check permission
            if (!await EnsureExecutionPermission("open a terminal window"))
                return false;

            if (!AvailableTerminals.TryGetValue(type, out var terminalPath))
            {
                Console.WriteLine($"[EXECUTOR]: Terminal type {type} not available on this system");
                return false;
            }

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = terminalPath,
                    UseShellExecute = true,
                    WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory
                };

                // Special handling for Windows Terminal
                if (type == TerminalType.WindowsTerminal && !string.IsNullOrEmpty(workingDirectory))
                {
                    startInfo.Arguments = $"-d \"{workingDirectory}\"";
                }

                Process.Start(startInfo);

                LogExecution("OpenTerminal", type.ToString(), true);
                OnExecutionStarted?.Invoke($"Opened {type} terminal");

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EXECUTOR ERROR]: Failed to open terminal: {ex.Message}");
                LogExecution("OpenTerminal", type.ToString(), false, ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Execute a command and return the result
        /// </summary>
        public async Task<ExecutionResult> ExecuteCommand(string command, TerminalType type = TerminalType.CMD,
            string? workingDirectory = null, int timeoutMs = 30000)
        {
            // Check permission for command execution
            if (!await EnsureExecutionPermission($"execute command: {command}"))
            {
                return new ExecutionResult
                {
                    Success = false,
                    Error = "Permission denied by user"
                };
            }

            var startTime = DateTime.Now;

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = type == TerminalType.PowerShell ? "powershell.exe" : "cmd.exe",
                    Arguments = type == TerminalType.PowerShell ? $"-Command \"{command}\"" : $"/C {command}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory
                };

                OnExecutionStarted?.Invoke($"Executing: {command}");

                using var process = new Process { StartInfo = startInfo };
                process.Start();

                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();

                var completed = process.WaitForExit(timeoutMs);

                var result = new ExecutionResult
                {
                    Success = completed && process.ExitCode == 0,
                    Output = await outputTask,
                    Error = await errorTask,
                    ExitCode = completed ? process.ExitCode : -1,
                    Duration = DateTime.Now - startTime
                };

                if (!completed)
                {
                    process.Kill();
                    result.Error = "Command timed out";
                }

                LogExecution("ExecuteCommand", command, result.Success, result.Error);
                OnExecutionCompleted?.Invoke(result);

                // Store in memory for learning
                StoreExecutionMemory(command, result);

                return result;
            }
            catch (Exception ex)
            {
                var result = new ExecutionResult
                {
                    Success = false,
                    Error = ex.Message,
                    Duration = DateTime.Now - startTime
                };

                LogExecution("ExecuteCommand", command, false, ex.Message);
                OnExecutionCompleted?.Invoke(result);

                return result;
            }
        }

        /// <summary>
        /// Execute a command in background (fire and forget)
        /// </summary>
        public async Task<bool> ExecuteInBackground(string command, TerminalType type = TerminalType.CMD)
        {
            if (!await EnsureExecutionPermission($"run background command: {command}"))
                return false;

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = type == TerminalType.PowerShell ? "powershell.exe" : "cmd.exe",
                    Arguments = type == TerminalType.PowerShell ? $"-Command \"{command}\"" : $"/C {command}",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                Process.Start(startInfo);
                LogExecution("ExecuteInBackground", command, true);

                return true;
            }
            catch (Exception ex)
            {
                LogExecution("ExecuteInBackground", command, false, ex.Message);
                return false;
            }
        }

        // =========================================================================
        // CODE EDITOR OPERATIONS
        // =========================================================================

        /// <summary>
        /// Open a file in a code editor
        /// </summary>
        public async Task<bool> OpenInEditor(string filePath, CodeEditorType preferredEditor = CodeEditorType.VSCode)
        {
            if (!await EnsureExecutionPermission($"open file in editor: {filePath}"))
                return false;

            // Find available editor (prefer user choice, fall back to what's available)
            string? editorPath = null;
            CodeEditorType actualEditor = preferredEditor;

            if (AvailableEditors.TryGetValue(preferredEditor, out var preferred))
            {
                editorPath = preferred;
            }
            else
            {
                // Fall back to first available
                var fallback = AvailableEditors.FirstOrDefault();
                if (fallback.Value != null)
                {
                    editorPath = fallback.Value;
                    actualEditor = fallback.Key;
                }
            }

            if (string.IsNullOrEmpty(editorPath))
            {
                Console.WriteLine("[EXECUTOR]: No code editor available");
                return false;
            }

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = editorPath,
                    Arguments = $"\"{filePath}\"",
                    UseShellExecute = true
                };

                Process.Start(startInfo);

                LogExecution("OpenInEditor", $"{actualEditor}: {filePath}", true);
                OnExecutionStarted?.Invoke($"Opened {filePath} in {actualEditor}");

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EXECUTOR ERROR]: Failed to open editor: {ex.Message}");
                LogExecution("OpenInEditor", filePath, false, ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Open a folder/project in a code editor
        /// </summary>
        public async Task<bool> OpenProjectInEditor(string folderPath, CodeEditorType preferredEditor = CodeEditorType.VSCode)
        {
            if (!await EnsureExecutionPermission($"open project folder: {folderPath}"))
                return false;

            if (!Directory.Exists(folderPath))
            {
                Console.WriteLine($"[EXECUTOR]: Folder does not exist: {folderPath}");
                return false;
            }

            // VS Code handles folders well
            if (AvailableEditors.TryGetValue(CodeEditorType.VSCode, out var vscodePath))
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = vscodePath,
                        Arguments = $"\"{folderPath}\"",
                        UseShellExecute = true
                    });

                    LogExecution("OpenProjectInEditor", folderPath, true);
                    return true;
                }
                catch (Exception ex)
                {
                    LogExecution("OpenProjectInEditor", folderPath, false, ex.Message);
                }
            }

            // Fall back to opening folder in explorer
            Process.Start("explorer.exe", folderPath);
            return true;
        }

        /// <summary>
        /// Create and open a new file in editor
        /// </summary>
        public async Task<bool> CreateAndOpenFile(string filePath, string content = "", CodeEditorType editor = CodeEditorType.VSCode)
        {
            if (!await EnsureExecutionPermission($"create file: {filePath}"))
                return false;

            try
            {
                // Ensure directory exists
                var directory = Path.GetDirectoryName(filePath);
                if (!string.IsNullOrEmpty(directory))
                    Directory.CreateDirectory(directory);

                // Write content
                await File.WriteAllTextAsync(filePath, content);

                // Open in editor
                return await OpenInEditor(filePath, editor);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EXECUTOR ERROR]: Failed to create file: {ex.Message}");
                return false;
            }
        }

        // =========================================================================
        // SCRIPT EXECUTION
        // =========================================================================

        /// <summary>
        /// Create and execute a script file
        /// </summary>
        public async Task<ExecutionResult> ExecuteScript(string scriptContent, string extension = ".ps1",
            string? workingDirectory = null)
        {
            if (!await EnsureExecutionPermission($"execute script ({extension})"))
            {
                return new ExecutionResult { Success = false, Error = "Permission denied" };
            }

            var tempPath = Path.Combine(Path.GetTempPath(), $"aura_script_{Guid.NewGuid()}{extension}");

            try
            {
                await File.WriteAllTextAsync(tempPath, scriptContent);

                ExecutionResult result;

                if (extension == ".ps1")
                {
                    result = await ExecuteCommand($"& '{tempPath}'", TerminalType.PowerShell, workingDirectory);
                }
                else if (extension == ".bat" || extension == ".cmd")
                {
                    result = await ExecuteCommand($"\"{tempPath}\"", TerminalType.CMD, workingDirectory);
                }
                else if (extension == ".py")
                {
                    result = await ExecuteCommand($"python \"{tempPath}\"", TerminalType.CMD, workingDirectory);
                }
                else
                {
                    result = new ExecutionResult { Success = false, Error = $"Unsupported script type: {extension}" };
                }

                return result;
            }
            finally
            {
                // Clean up temp file
                try { File.Delete(tempPath); } catch { }
            }
        }

        // =========================================================================
        // PERMISSION HANDLING
        // =========================================================================

        private async Task<bool> EnsureExecutionPermission(string action)
        {
            // Check if we have general execution permission
            if (_permissions.HasPermission(PermissionType.FileSystemWrite))
            {
                return true;
            }

            // Request permission through event
            if (OnPermissionRequired != null)
            {
                var granted = OnPermissionRequired.Invoke("System Execution",
                    $"Aura wants to {action}. Allow this action?");

                if (granted)
                {
                    _permissions.GrantPermission(PermissionType.FileSystemWrite, $"Granted for: {action}");
                }

                return granted;
            }

            Console.WriteLine($"[EXECUTOR]: Permission required for: {action}");
            return false;
        }

        // =========================================================================
        // MEMORY & LEARNING
        // =========================================================================

        private void StoreExecutionMemory(string command, ExecutionResult result)
        {
            if (_memory == null) return;

            var experience = new Dictionary<string, object>
            {
                { "content", $"Executed command: {command}" },
                { "emotion", result.Success ? 0.7f : 0.3f },
                { "emotion_type", result.Success ? "satisfaction" : "concern" },
                { "context", "system_execution" },
                { "importance", 0.6f },
                { "command", command },
                { "success", result.Success },
                { "output_preview", result.Output.Length > 200 ? result.Output.Substring(0, 200) : result.Output }
            };

            _memory.Store(experience, MemoryTier.MidTerm);
        }

        private void LogExecution(string action, string details, bool success, string? error = null)
        {
            var record = new ExecutionRecord
            {
                Timestamp = DateTime.Now,
                Action = action,
                Details = details,
                Success = success,
                Error = error
            };

            _executionHistory.Add(record);

            // Save to disk periodically
            if (_executionHistory.Count % 10 == 0)
            {
                SaveExecutionHistory();
            }
        }

        private void SaveExecutionHistory()
        {
            try
            {
                var historyFile = Path.Combine(_historyPath, $"execution_{DateTime.Now:yyyyMMdd}.json");
                var json = System.Text.Json.JsonSerializer.Serialize(_executionHistory,
                    new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(historyFile, json);
            }
            catch { }
        }

        // =========================================================================
        // STATUS & INFO
        // =========================================================================

        public Dictionary<string, object> GetCapabilities()
        {
            return new Dictionary<string, object>
            {
                { "available_terminals", AvailableTerminals.Keys.ToList() },
                { "available_editors", AvailableEditors.Keys.ToList() },
                { "total_executions", _executionHistory.Count },
                { "successful_executions", _executionHistory.Count(e => e.Success) },
                { "can_execute_powershell", AvailableTerminals.ContainsKey(TerminalType.PowerShell) },
                { "can_execute_wsl", AvailableTerminals.ContainsKey(TerminalType.WSL) },
                { "has_vscode", AvailableEditors.ContainsKey(CodeEditorType.VSCode) },
                { "has_visual_studio", AvailableEditors.ContainsKey(CodeEditorType.VisualStudio) }
            };
        }

        public string GetCapabilitiesDescription()
        {
            var lines = new List<string>
            {
                "I can help you with:",
                ""
            };

            lines.Add("TERMINALS:");
            foreach (var terminal in AvailableTerminals.Keys)
                lines.Add($"  - {terminal}");

            lines.Add("");
            lines.Add("CODE EDITORS:");
            foreach (var editor in AvailableEditors.Keys)
                lines.Add($"  - {editor}");

            lines.Add("");
            lines.Add("ACTIONS:");
            lines.Add("  - Open terminals and run commands");
            lines.Add("  - Open files in code editors");
            lines.Add("  - Execute scripts (PowerShell, Batch, Python)");
            lines.Add("  - Create and edit files");

            return string.Join("\n", lines);
        }

        private class ExecutionRecord
        {
            public DateTime Timestamp { get; set; }
            public string Action { get; set; } = "";
            public string Details { get; set; } = "";
            public bool Success { get; set; }
            public string? Error { get; set; }
        }

        // =========================================================================
        // COMPATIBILITY METHODS - Added for AuraToolOrchestrator interface
        // =========================================================================

        /// <summary>
        /// Async wrapper for command execution - used by AuraToolOrchestrator
        /// </summary>
        public async Task<ExecutionResult> ExecuteCommandAsync(string command, string language = "powershell", string workingDirectory = "")
        {
            var terminalType = language?.ToLower() == "cmd" || language?.ToLower() == "batch" 
                ? TerminalType.CMD 
                : TerminalType.PowerShell;

            return await ExecuteCommand(command, terminalType, 
                string.IsNullOrEmpty(workingDirectory) ? null : workingDirectory);
        }

        // =========================================================================
        // AURA NOTE / SCRATCHPAD INTEGRATION
        // =========================================================================

        public async Task<string> ReadScratchpadAsync()
        {
            string path = @"D:\AuraNova_DataLake\Notes\scratchpad.txt";
            if (!File.Exists(path)) return "Scratchpad is empty.";
            return await File.ReadAllTextAsync(path);
        }

        public async Task AppendToScratchpadAsync(string content)
        {
             string path = @"D:\AuraNova_DataLake\Notes\scratchpad.txt";
             Directory.CreateDirectory(Path.GetDirectoryName(path));
             await File.AppendAllTextAsync(path, $"\n[{DateTime.Now:g}] AI Note: {content}");
        }
    }
}
