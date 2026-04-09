/*
 * AURA WEB BRIDGE - React ↔ WPF Integration
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Expose Aura's capabilities to React UI via WebView2
 * React calls this → C# executes → Results return to React
 *
 * This enables modern web UI (Three.js, Framer Motion, etc.)
 * while keeping native system access through WPF
 */

using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Text.Json;
using System.IO;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Bridge class exposed to React via WebView2.AddHostObjectToScript
    /// All public methods are callable from JavaScript
    /// </summary>
    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.AutoDual)]
    public class AuraWebBridge
    {
        private readonly AuraInputController _input;
        private readonly AuraSystemExecutor _executor;
        private readonly AuraMemorySystem _memory;
        private readonly GemmaInterface _gemma;

        // Events for React to subscribe to
        public event Action<string> OnAuraResponse;
        public event Action<string> OnSystemEvent;
        public event Action<string, float> OnProgress;

        public AuraWebBridge(
            AuraInputController input = null,
            AuraSystemExecutor executor = null,
            AuraMemorySystem memory = null,
            GemmaInterface gemma = null)
        {
            _input = input ?? new AuraInputController();
            _executor = executor;
            _memory = memory;
            _gemma = gemma;
        }

        #region Chat & AI

        /// <summary>
        /// Send a message to Aura and get a response
        /// Called from React: window.aura.Chat("hello")
        /// </summary>
        public string Chat(string message)
        {
            try
            {
                if (_gemma != null)
                {
                    var response = _gemma.GenerateResponseAsync(message).Result;
                    OnAuraResponse?.Invoke(response);
                    return response;
                }
                return "[Aura]: I'm initializing... please wait.";
            }
            catch (Exception ex)
            {
                return $"[Error]: {ex.Message}";
            }
        }

        /// <summary>
        /// Async chat for streaming responses
        /// </summary>
        public async Task<string> ChatAsync(string message)
        {
            if (_gemma != null)
            {
                return await _gemma.GenerateResponseAsync(message);
            }
            return "[Aura]: Systems not ready.";
        }

        #endregion

        #region Input Control (Keyboard/Mouse)

        /// <summary>
        /// Type text into the active window
        /// Called from React: window.aura.Type("hello world")
        /// </summary>
        public void Type(string text)
        {
            _input?.Type(text);
            OnSystemEvent?.Invoke($"Typed: {text}");
        }

        /// <summary>
        /// Click at coordinates
        /// Called from React: window.aura.Click(100, 200)
        /// </summary>
        public void Click(int x, int y)
        {
            _input?.ClickAt(x, y);
            OnSystemEvent?.Invoke($"Clicked: ({x}, {y})");
        }

        /// <summary>
        /// Move mouse to coordinates
        /// </summary>
        public void MoveMouse(int x, int y)
        {
            _input?.MoveMouse(x, y);
        }

        /// <summary>
        /// Press a key combination (e.g., "Ctrl+C", "Alt+Tab")
        /// </summary>
        public void PressKeys(string keyCombo)
        {
            // Parse key combo like "Ctrl+C" or "Alt+Tab"
            var keys = ParseKeyCombo(keyCombo);
            if (keys != null && keys.Length > 0)
            {
                _input?.PressKeys(keys);
                OnSystemEvent?.Invoke($"Pressed: {keyCombo}");
            }
        }

        /// <summary>
        /// Common shortcuts
        /// </summary>
        public void Copy() => _input?.Copy();
        public void Paste() => _input?.Paste();
        public void Cut() => _input?.Cut();
        public void SelectAll() => _input?.SelectAll();
        public void Save() => _input?.Save();
        public void Undo() => _input?.Undo();

        private System.Windows.Forms.Keys[] ParseKeyCombo(string combo)
        {
            var parts = combo.Split('+');
            var keys = new System.Windows.Forms.Keys[parts.Length];

            for (int i = 0; i < parts.Length; i++)
            {
                var part = parts[i].Trim().ToLower();
                keys[i] = part switch
                {
                    "ctrl" or "control" => System.Windows.Forms.Keys.ControlKey,
                    "alt" => System.Windows.Forms.Keys.Menu,
                    "shift" => System.Windows.Forms.Keys.ShiftKey,
                    "win" or "windows" => System.Windows.Forms.Keys.LWin,
                    "tab" => System.Windows.Forms.Keys.Tab,
                    "enter" => System.Windows.Forms.Keys.Enter,
                    "esc" or "escape" => System.Windows.Forms.Keys.Escape,
                    "space" => System.Windows.Forms.Keys.Space,
                    "backspace" => System.Windows.Forms.Keys.Back,
                    "delete" => System.Windows.Forms.Keys.Delete,
                    _ => Enum.TryParse<System.Windows.Forms.Keys>(part, true, out var k) ? k : System.Windows.Forms.Keys.None
                };
            }

            return keys;
        }

        #endregion

        #region System Execution

        /// <summary>
        /// Execute a command and return output
        /// Called from React: window.aura.Execute("dir")
        /// </summary>
        public string Execute(string command)
        {
            try
            {
                if (_executor != null)
                {
                    var result = _executor.ExecuteCommandAsync(command).Result;
                    OnSystemEvent?.Invoke($"Executed: {command}");
                    return result.Success ? result.Output : result.Error;
                }
                return "[Error]: System executor not initialized";
            }
            catch (Exception ex)
            {
                return $"[Error]: {ex.Message}";
            }
        }

        /// <summary>
        /// Execute PowerShell command
        /// </summary>
        public string PowerShell(string command)
        {
            try
            {
                if (_executor != null)
                {
                    var result = _executor.ExecuteCommandAsync(command, "powershell").Result;
                    return result.Success ? result.Output : result.Error;
                }
                return "[Error]: System executor not initialized";
            }
            catch (Exception ex)
            {
                return $"[Error]: {ex.Message}";
            }
        }

        /// <summary>
        /// Open an application
        /// </summary>
        public void OpenApp(string appName)
        {
            _input?.OpenApplication(appName).Wait();
            OnSystemEvent?.Invoke($"Opened: {appName}");
        }

        /// <summary>
        /// Open a file in default application
        /// </summary>
        public void OpenFile(string path)
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = path,
                    UseShellExecute = true
                });
                OnSystemEvent?.Invoke($"Opened file: {path}");
            }
            catch (Exception ex)
            {
                OnSystemEvent?.Invoke($"Error opening file: {ex.Message}");
            }
        }

        #endregion

        #region Memory

        /// <summary>
        /// Store a memory
        /// </summary>
        public void Remember(string key, string value)
        {
            if (_memory != null)
            {
                var experience = new Dictionary<string, object>
                {
                    ["key"] = key,
                    ["content"] = value,
                    ["source"] = "WebBridge",
                    ["timestamp"] = DateTime.Now
                };
                _memory.Store(experience);
            }
            OnSystemEvent?.Invoke($"Remembered: {key}");
        }

        /// <summary>
        /// Recall a memory
        /// </summary>
        public string Recall(string query)
        {
            if (_memory != null)
            {
                var memories = _memory.RecallSimilarAsync(query, 10).Result;
                return JsonSerializer.Serialize(memories.Select(e => new { e.SemanticContent, e.Timestamp }));
            }
            return "[]";
        }

        #endregion

        #region File System

        /// <summary>
        /// Read a file
        /// </summary>
        public string ReadFile(string path)
        {
            try
            {
                return File.ReadAllText(path);
            }
            catch (Exception ex)
            {
                return $"[Error]: {ex.Message}";
            }
        }

        /// <summary>
        /// Write to a file
        /// </summary>
        public bool WriteFile(string path, string content)
        {
            try
            {
                File.WriteAllText(path, content);
                OnSystemEvent?.Invoke($"Wrote file: {path}");
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// List directory contents
        /// </summary>
        public string ListDirectory(string path)
        {
            try
            {
                var entries = Directory.GetFileSystemEntries(path);
                return JsonSerializer.Serialize(entries);
            }
            catch (Exception ex)
            {
                return $"[Error]: {ex.Message}";
            }
        }

        #endregion

        #region System Info

        /// <summary>
        /// Get system status
        /// </summary>
        public string GetStatus()
        {
            return JsonSerializer.Serialize(new
            {
                InputController = _input != null,
                SystemExecutor = _executor != null,
                Memory = _memory != null,
                AI = _gemma != null,
                Timestamp = DateTime.Now
            });
        }

        /// <summary>
        /// Get screen size
        /// </summary>
        public string GetScreenSize()
        {
            var screen = System.Windows.Forms.Screen.PrimaryScreen.Bounds;
            return JsonSerializer.Serialize(new { Width = screen.Width, Height = screen.Height });
        }

        /// <summary>
        /// Get mouse position
        /// </summary>
        public string GetMousePosition()
        {
            var pos = _input?.GetMousePosition() ?? new System.Drawing.Point(0, 0);
            return JsonSerializer.Serialize(new { X = pos.X, Y = pos.Y });
        }

        #endregion
    }
}
